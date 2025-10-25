import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIChannelMessageJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from './addReaction.js';

/**
 * Edits a message in a channel.
 * @param guildId The ID of the guild where the channel belongs.
 * @param channelId The ID of the channel where the message is located.
 * @param msgId The ID of the message to edit.
 * @param payload The new message content.
 * @returns A Promise that resolves with the edited message or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 channelId: string,
 msgId: string,
 payload: RESTPatchAPIChannelMessageJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).channels
  .editMessage(channelId, msgId, payload)
  .then((m) => cache.messages.apiToR(m, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
