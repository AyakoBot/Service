import type { DiscordAPIError } from '@discordjs/rest';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a global command from the cache or from the Discord API.
 * @param guildId - The guild ID where the command is located.
 * @param commandId - The ID of the command to retrieve.
 * @returns A Promise that resolves with the retrieved command or rejects with an error.
 */
export default async (guildId: string, commandId: string) =>
 (await cache.commands.get(commandId)) ??
 (await getAPI(guildId)).applicationCommands
  .getGlobalCommand(await getBotIdFromGuild(guildId), commandId)
  .then((cmd) => {
   cache.commands.set(cmd);
   return cache.commands.apiToR(cmd);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });

/**
 * Checks if the guild can get commands.
 * A guild can get commands if the number of bot members in the guild is less than or equal to 50.
 *
 * @param guildId - The guild ID to check.
 * @returns A boolean indicating whether the guild can get commands.
 */
export const canGetCommands = async (guildId: string) => {
 const members = await cache.members.getAll(guildId);
 if (!members.length) return false;

 let bots = 0;
 while (members.length > 0 && bots !== 50)
  (await cache.users.get(members.shift()!.user_id))?.bot && bots++;
 return !(members.length > 0 && bots > 50);
};
