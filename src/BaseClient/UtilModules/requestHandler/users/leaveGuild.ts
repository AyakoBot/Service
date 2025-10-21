import * as Discord from 'discord.js';
import { api } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Leaves the specified guild.
 * @param guild - The guild to leave.
 * @param client - Whether to use the main client
 * @returns A promise that resolves with the DiscordAPIError if an error occurs, otherwise void.
 */
export default async (guild: RGuild, client: boolean = false) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return ((!client ? await getAPI(guild) : API) ?? API).users
  .leaveGuild(guild.id)
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};
