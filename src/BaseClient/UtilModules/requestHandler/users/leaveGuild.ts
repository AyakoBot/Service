import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { api } from '../../../Client.js';

/**
 * Leaves the specified guild.
 * @param guildId - The ID of the guild to leave.
 * @param useMainClient - Whether to use the main client API instead of guild-specific API.
 * @returns A promise that resolves with the DiscordAPIError if an error occurs, otherwise void.
 */
export default async (guildId: string, useMainClient: boolean = false) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (useMainClient ? api : await getAPI(guildId)).users
  .leaveGuild(guildId)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
