import * as Discord from 'discord.js';
import { type UsualMessagePayload } from '../../Typings/Typings.js';
import constants from '../Other/constants.js';
import error, { sendDebugMessage } from './error.js';
import * as replyMsg from './replyMsg.js';
import { isValidPayload } from './requestHandler/channels/sendMessage.js';

type ReturnType<T extends boolean | undefined, K extends Discord.CacheType> = T extends true
 ? K extends 'cached'
   ? Discord.InteractionResponse<true> | undefined
   : Discord.InteractionResponse<false> | undefined
 : undefined;

/**
 * Sends a reply to an interaction (button, command, select menu, or modal submit).
 * @param cmd The interaction to reply to.
 * @param payload The reply options to send.
 * @returns If `withResponse` is `true`, returns the message that was sent.
 * Otherwise, returns `undefined`.
 * @throws If the interaction is not repliable.
 */
const replyCmd = async <T extends boolean | undefined, K extends Discord.CacheType>(
 cmd:
  | Discord.ButtonInteraction<K>
  | Discord.CommandInteraction<K>
  | Discord.AnySelectMenuInteraction<K>
  | Discord.ModalSubmitInteraction<K>,
 payload: Discord.InteractionReplyOptions & {
  withResponse?: T;
 },
): Promise<ReturnType<T, K>> => {
 if ('respond' in cmd) return Promise.resolve(undefined);
 if (!isValidPayload(payload as UsualMessagePayload)) {
  sendDebugMessage({
   content: `bad payload`,
   files: [cmd.client.util.txtFileWriter(JSON.stringify(payload, null, 2))],
  });
  return undefined;
 }

 if (payload.ephemeral === false) payload.flags = undefined;
 else payload.flags = RMessageFlags.Ephemeral;
 delete payload.ephemeral;

 if (!payload.flags) {
  (payload.flags as unknown as number) = RMessageFlags.SuppressNotifications;
 }

 payload.embeds
  ?.filter((e) => !!e)
  .forEach((embed) => {
   if ('author' in embed && !embed.author?.url && embed.author?.name) {
    embed.author = { ...embed.author, url: constants.standard.invite };
   }
  });

 if ('reply' in cmd && cmd.isRepliable()) {
  const m = await cmd.reply(payload).catch((e: DiscordAPIError) => {
   if (
    cmd.guild &&
    !JSON.stringify(e).includes(String(Discord.RESTJSONErrorCodes.UnknownInteraction)) &&
    !JSON.stringify(e).includes('InteractionAlreadyReplied') &&
    !JSON.stringify(e).includes('Interaction has already been acknowledged')
   ) {
    error(cmd.guild, e);
   }
   return undefined;
  });
  if (typeof m === 'undefined') return m;
  return m as ReturnType<T, K>;
 }

 throw new Error('Unrepliable Interaction');
};

/**
 * Sends a reply to a Discord interaction and handles cooldowns if provided.
 * @param cmd The interaction to reply to.
 * @param payload The reply options to send.
 * @param command The command that triggered the interaction.
 * @param commandName The name of the command that triggered the interaction,
 * required for handling cooldowns.
 * @returns The sent message if `withResponse` is `true`, otherwise `undefined`.
 */
export default async <T extends boolean | undefined, K extends Discord.CacheType>(
 cmd:
  | Discord.ButtonInteraction<K>
  | Discord.CommandInteraction<K>
  | Discord.AnySelectMenuInteraction<K>
  | Discord.ModalSubmitInteraction<K>,
 payload: Discord.InteractionReplyOptions & {
  withResponse?: T;
 },
 commandName?: string,
): Promise<ReturnType<T, K>> => {
 if (!cmd) return undefined;

 const sentMessage = await replyCmd(cmd, payload);
 if (!sentMessage) return undefined;

 if (commandName) replyMsg.cooldownHandler(cmd, sentMessage, commandName);

 return sentMessage;
};
