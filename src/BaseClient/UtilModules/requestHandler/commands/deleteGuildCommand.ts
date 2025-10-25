import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import botCache from '../../cache.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';

/**
 * Deletes a guild command from the Discord API and removes it from the guild's command cache.
 * @param guildId The guild ID where the command is located.
 * @param commandId The ID of the command to be deleted.
 * @param mainId The main bot ID from environment.
 * @returns A promise that resolves when the command is successfully deleted,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, commandId: string, mainId?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const botId = await getBotIdFromGuild(guildId);
 if (!botId) {
  const e = requestHandlerError(
   `Cannot get own Commands. Please make sure you don't have more than 50 Bots in your Server`,
   [],
  );

  error(guildId, e);
  return e;
 }

 if (await hasMissingScopes(guildId)) return [];

 if (
  mainId &&
  botId !== mainId &&
  !botCache.apis.get(guildId) &&
  !(await makeRequestHandler(guildId))
 ) {
  return new Error('Failed to set up API');
 }

 return (await getAPI(guildId)).applicationCommands
  .deleteGuildCommand(botId, guildId, commandId)
  .then(() => {
   cache.guildCommands.del(guildId, commandId);
   return true;
  })
  .catch((e: DiscordAPIError) => {
   if (mainId) setHasMissingScopes(e.message, guildId, botId, mainId);

   if (JSON.stringify(e).includes('Unknown application command')) {
    cache.guildCommands.del(guildId, commandId);
    return true;
   }

   error(guildId, e);
   return e;
  });
};
