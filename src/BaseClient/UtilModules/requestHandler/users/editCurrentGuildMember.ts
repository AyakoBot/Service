import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildMemberJSONBody } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits the current guild member with the given data.
 * @param guildId - The guild ID where the member is located.
 * @param data - The data to update the member with.
 * @returns A promise that resolves with the updated guild member
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, data: RESTPatchAPIGuildMemberJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).users
  .editCurrentGuildMember(guildId, data)
  .then((m) => cache.members.apiToR(m, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
