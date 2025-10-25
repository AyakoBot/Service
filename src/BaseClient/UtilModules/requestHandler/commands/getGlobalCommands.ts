import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIApplicationCommandsQuery } from 'discord-api-types/v10.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the global slash commands for a guild.
 * @param guildId - The guild ID to retrieve the commands for.
 * @param query - Optional query parameters to filter the commands.
 * @returns A Promise that resolves to an array of parsed ApplicationCommand objects.
 */
export default async (guildId: string | undefined, query?: RESTGetAPIApplicationCommandsQuery) =>
 (await getAPI(guildId)).applicationCommands
  .getGlobalCommands(await getBotIdFromGuild(guildId), query)
  .then((cmds) => {
   cmds.forEach((cmd) => cache.commands.set(cmd));
   return cmds.map((cmd) => cache.commands.apiToR(cmd));
  })
  .catch((e: DiscordAPIError) => {
   if (guildId) error(guildId, e);
   return e;
  });
