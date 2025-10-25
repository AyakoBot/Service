import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPutAPIApplicationCommandsJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Overwrites all global application commands for a guild.
 * @param guildId - The guild ID to overwrite the commands for.
 * @param body - The JSON body containing the new commands.
 * @returns A promise that resolves with an array of the newly created application commands.
 */
export default async (guildId: string, body: RESTPutAPIApplicationCommandsJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const botId = await getBotIdFromGuild(guildId);

 return (await getAPI(guildId)).applicationCommands
  .bulkOverwriteGlobalCommands(botId, body)
  .then((cmds) => {
   cache.commands
    .getAll(botId)
    .then((cmds) => cache.commands.del(...cmds.map((c) => c.id)))
    .then(() => cmds.map((c) => cache.commands.set(c)));

   return cmds.map((cmd) => cache.commands.apiToR(cmd));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
