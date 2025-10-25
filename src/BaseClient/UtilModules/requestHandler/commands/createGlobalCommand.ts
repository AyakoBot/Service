import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Creates a global command for the given guild.
 * @param guildId - The guild ID to create the command for.
 * @param body - The REST API JSON body for the command.
 * @returns A Promise that resolves with the created ApplicationCommand object,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIApplicationCommandsJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const botId = await getBotIdFromGuild(guildId);

 return (await getAPI(guildId)).applicationCommands
  .createGlobalCommand(botId, body)
  .then((cmd) => {
   cache.commands.set(cmd);
   return cache.commands.apiToR(cmd);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
