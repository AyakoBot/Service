import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a global command from the Discord API and removes it from the cache.
 * @param guildId - The guild ID where the command is registered.
 * @param commandId - The ID of the command to be deleted.
 * @returns A promise that resolves when the command is successfully deleted
 * and removed from the cache,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, commandId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const botId = await getBotIdFromGuild(guildId);

 return (await getAPI(guildId)).applicationCommands
  .deleteGlobalCommand(botId, commandId)
  .then(() => {
   cache.commands.del(commandId);
   return true;
  })
  .catch((e: DiscordAPIError) => {
   if (JSON.stringify(e).includes('Unknown application command')) {
    cache.commands.del(commandId);
    return true;
   }
   error(guildId, e);
   return e;
  });
};
