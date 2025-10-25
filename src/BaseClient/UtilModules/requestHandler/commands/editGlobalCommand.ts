import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIApplicationCommandJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Edits a global command for the given guild.
 * @param guildId - The guild ID where the command is located.
 * @param commandId - The ID of the command to edit.
 * @param body - The new command data to update.
 * @returns A Promise that resolves with the updated command.
 */
export default async (
 guildId: string,
 commandId: string,
 body: RESTPatchAPIApplicationCommandJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const botId = await getBotIdFromGuild(guildId);

 return (await getAPI(guildId)).applicationCommands
  .editGlobalCommand(botId, commandId, body)
  .then((cmd) => {
   cache.commands.set(cmd);
   return cache.commands.apiToR(cmd);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
