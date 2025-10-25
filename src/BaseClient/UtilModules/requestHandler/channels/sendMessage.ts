import type { DiscordAPIError, RawFile } from '@discordjs/rest';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 PermissionFlagsBits,
 type APIEmbed,
 type RESTPostAPIChannelMessageJSONBody,
} from 'discord-api-types/v10.js';
import { cache } from 'src/BaseClient/Client.js';

import { AllThreadGuildChannelTypes } from '../../../../Typings/Channel.js';
import { type UsualMessagePayload } from '../../../../Typings/Typings.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import error, { sendDebugMessage } from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import txtFileWriter from '../../txtFileWriter.js';
import { resolveFile } from '../../util.js';

import { getAPI } from './addReaction.js';

/**
 * Sends a message to a Discord channel with optional file attachments.
 *
 * @param guildId - The ID of the guild where the channel is located. Can be null/undefined for DM channels.
 * @param channelId - The ID of the channel to send the message to.
 * @param payload - The message payload containing content, embeds, components, and optional files.
 * @param payload.files - Optional array of file attachments to include with the message.
 *
 * @returns A Promise that resolves to:
 * - `RMessage` - The successfully sent message object
 * - `Error` - A generic error (e.g., when silent mode is enabled or no payload provided)
 * - `DiscordAPIError` - A Discord API specific error
 *
 * @remarks
 * - Returns an error immediately if the application is running in silent mode (--silent flag)
 * - Validates bot permissions before attempting to send the message
 * - Processes file attachments by resolving file data and assigning unique names
 * - Automatically sets `fail_if_not_exists` to false for message references
 * - Logs debug information for failed requests (except for user-specific errors)
 * - Caches successful message responses
 */
function fn<T extends string | undefined | null>(
 guildId: T,
 channelId: string,
 payload: RESTPostAPIChannelMessageJSONBody & {
  files?: RawFile[];
 },
): Promise<RMessage | Error | DiscordAPIError>;
function fn(
 guildId: string,
 channelId: string,
 payload: RESTPostAPIChannelMessageJSONBody & {
  files?: RawFile[];
 },
): Promise<RMessage | Error | DiscordAPIError>;
async function fn(
 guildId: string | undefined | null,
 channelId: string,
 payload: RESTPostAPIChannelMessageJSONBody & {
  files?: RawFile[];
 },
): Promise<RMessage | Error | DiscordAPIError> {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');
 if (!payload || String(payload) === 'undefined') return new Error('No payload provided');

 const debugStack = new Error().stack;

 const files = payload.files
  ? ([
     ...(
      await Promise.all(
       payload.files.filter((f): f is RawFile => 'attachment' in f).map((f) => resolveFile(f.data)),
      )
     ).map((f, i) => ({
      ...f,
      name: String(Date.now() + i),
     })),
     ...payload.files.filter((f): f is RawFile => !('attachment' in f)),
    ] as RawFile[])
  : undefined;

 if (
  guildId &&
  !canSendMessage(
   guildId,
   channelId,
   { ...payload, files },
   (await getBotMemberFromGuild(guildId)).user_id,
  )
 ) {
  const e = requestHandlerError(`Cannot send message`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.SendMessages,
   PermissionFlagsBits.SendMessagesInThreads,
   PermissionFlagsBits.ReadMessageHistory,
   PermissionFlagsBits.AttachFiles,
  ]);

  error(guildId, e, false);
  return e;
 }

 return (await getAPI(guildId)).channels
  .createMessage(channelId, {
   ...payload,
   files,
   attachments: [],
   message_reference: payload.message_reference
    ? { ...payload.message_reference, fail_if_not_exists: false }
    : undefined,
  })
  .then((m) => cache.messages.apiToR(m, guildId || '@me'))
  .catch(async (e: DiscordAPIError) => {
   if (!e.message.includes('to this user')) {
    sendDebugMessage({
     content: `${guildId} - ${channelId} - ${guildId ? (await getBotMemberFromGuild(guildId)).user_id : '-'}\n${e.message}\n${debugStack}`,
     files: [txtFileWriter(JSON.stringify({ ...payload, files: payload.files?.length }, null, 2))],
    });

    error(guildId, new Error((e as DiscordAPIError).message));
   }
   return e;
  });
}

export default fn;

/**
 * Checks if a user has permission to send a message in a specific channel with the given payload.
 *
 * @param guildId - The ID of the guild where the channel is located
 * @param channelId - The ID of the channel to send the message to
 * @param payload - The message payload containing message data and optional files
 * @param userId - The ID of the user attempting to send the message
 *
 * @returns A promise that resolves to `true` if the user can send the message, `false` otherwise.
 *          May modify the payload by removing TTS or message reference if the user lacks specific permissions.
 *
 * @remarks
 * This function performs multiple permission checks including:
 * - Channel viewing permissions
 * - Message sending permissions (regular channels vs threads)
 * - TTS message permissions (removes TTS flag if lacking permission)
 * - Message history reading for replies (removes message reference if lacking permission)
 * - File attachment permissions
 * - Embed link permissions
 * - User timeout/communication disabled status
 */
export const canSendMessage = async (
 guildId: string,
 channelId: string,
 payload: RESTPostAPIChannelMessageJSONBody & {
  files?: RawFile[];
 },
 userId: string,
) => {
 if (!channelId) return true;

 switch (true) {
  case payload.message_reference &&
   !(await checkChannelPermissions(guildId, channelId, ['ReadMessageHistory'], userId)):
   return false;
  case !(await checkChannelPermissions(guildId, channelId, ['ViewChannel'], userId)):
   return false;
  case Number((await cache.members.get(guildId, userId))?.communication_disabled_until) >
   Date.now():
   return false;
  case !AllThreadGuildChannelTypes.includes(
   (await cache.channels.get(channelId))?.type || ChannelType.GuildText,
  ) && !(await checkChannelPermissions(guildId, channelId, ['SendMessages'], userId)):
  case AllThreadGuildChannelTypes.includes(
   (await cache.channels.get(channelId))?.type || ChannelType.GuildText,
  ) && !(await checkChannelPermissions(guildId, channelId, ['SendMessagesInThreads'], userId)):
   return false;
  case payload.tts &&
   !(await checkChannelPermissions(guildId, channelId, ['SendTTSMessages'], userId)): {
   payload.tts = false;
   return true;
  }
  case payload.message_reference &&
   !(await checkChannelPermissions(guildId, channelId, ['ReadMessageHistory'], userId)): {
   payload.message_reference = undefined;
   return true;
  }
  case payload.files?.length &&
   !(await checkChannelPermissions(guildId, channelId, ['AttachFiles'], userId)):
   return false;
  case payload.embeds?.length &&
   !(await checkChannelPermissions(guildId, channelId, ['EmbedLinks'], userId)):
   return false;
  default:
   return true;
 }
};

/**
 * Checks if the given payload is a valid message payload.
 * @param payload The message payload to validate.
 * @returns Returns true if the payload is valid, otherwise false.
 */
export const isValidPayload = (payload: UsualMessagePayload) => {
 const e = (text: string, log: unknown) => {
  // eslint-disable-next-line no-console
  console.log(`> ${text}\n${JSON.stringify(log)}`);
  // eslint-disable-next-line no-console
  console.log(text);
  return false;
 };

 if (Number(payload.content?.length) > 2000) return e('Content too long', payload.content);
 if (payload.embeds?.length) {
  if (Number(payload.embeds.length) > 10) return e('Too many Embeds', payload.embeds);
  if (payload.embeds && getEmbedCharLens(payload.embeds) > 6000) {
   return e('Embeds content too long', payload.embeds);
  }

  const embedsValid = payload.embeds
   .map((embed) => {
    if (Number(embed.title?.length) > 256) return e('Embed Title too long', embed.title);
    if (Number(embed.description?.length) > 4096) {
     return e('Embed Description too long', embed.description);
    }

    if (Number(embed.footer?.text?.length) > 2048) return e('Embed Footer too long', embed.footer);
    if (Number(embed.author?.name?.length) > 2048) return e('Embed Author too long', embed.author);

    if (!embed.fields?.length) return true;
    if (embed.fields.length > 25) return e('Too many Embed Fields', embed.fields);
    return embed.fields
     ?.map((f) => {
      if (Number(f.name?.length) > 256) return e('Embed Field Name too long', f.name);
      if (Number(f.value?.length) > 1024) return e('Embed Field Value too long', f.value);
      return true;
     })
     .every((f) => !!f);
   })
   .every((f) => !!f);

  if (!embedsValid) return embedsValid;
 }

 if (payload.components) {
  const customIds = payload.components
   .map((a) => a.components.map((c) => ('custom_id' in c ? c.custom_id : undefined)))
   .flat()
   .filter((s): s is string => !!s);
  if (customIds.length !== new Set(customIds).size) return e('Duplicate Custom IDs', customIds);

  const check = payload.components
   .map((actionRow) => {
    if (!actionRow.components.length) return e('Empty Action Row', actionRow);

    const check1 = actionRow.components
     .map((c) => {
      switch (c.type) {
       case ComponentType.Button: {
        if (c.style === ButtonStyle.Premium) break;
        if (Number(c.label?.length) > 80) return e('Button Label too long', c.label);
        if ('custom_id' in c && Number(c.custom_id?.length) > 100) {
         return e('Button Custom ID too long', c.custom_id);
        }
        break;
       }
       case ComponentType.RoleSelect:
       case ComponentType.UserSelect:
       case ComponentType.MentionableSelect:
       case ComponentType.StringSelect:
       case ComponentType.ChannelSelect: {
        if (Number(c.custom_id?.length) > 100) {
         return e('Select Menu Custom ID too long', c.custom_id);
        }
        if ('options' in c) {
         if (c.options.length > 25) return e('Too many Select Menu Options', c.options);
         const check2 = c.options
          .map((o) => {
           if (o.label.length > 100) return e('Select Menu Option Label too long', o.label);
           if (o.value.length > 100) return e('Select Menu Option Value too long', o.value);
           if (Number(o.description?.length) > 100) {
            return e('Select Menu Option Description too long', o.description);
           }
           return true;
          })
          .every((f) => !!f);
         if (!check2) return check2;
        }
        if (Number(c.placeholder?.length) > 150) {
         return e('Select Menu Placeholder too long', c);
        }
        if (c.min_values && c.min_values > 25) {
         return e('Select Menu Min Values too high', c);
        }
        if (c.min_values && c.min_values < 0) {
         return e('Select Menu Min Values too low', c);
        }
        if (c.max_values && c.max_values > 25) {
         return e('Select Menu Max Values too high', c);
        }
        break;
       }
       default:
        return true;
      }
      return true;
     })
     .every((f) => !!f);
    if (!check1) return false;
    return true;
   })
   .every((f) => !!f);
  if (!check) return false;
 }

 return true;
};

/**
 * Calculates the total character length of all strings in an array of Discord API embeds.
 * @param embeds - An array of Discord API embeds.
 * @returns The total character length of all strings in the embeds.
 */
export const getEmbedCharLens = (embeds: APIEmbed[]) => {
 let total = 0;
 embeds.forEach((embed) => {
  Object.values(embed).forEach((data) => {
   if (typeof data === 'string') total += data.length;
  });

  for (let i = 0; i < (embed.fields ? embed.fields.length : 0); i += 1) {
   const field = embed.fields ? embed.fields[i] : null;

   if (!field) return;

   if (typeof field.name === 'string') total += field.name.length;
   if (typeof field.value === 'string') total += field.value.length;
  }
 });
 return total;
};
