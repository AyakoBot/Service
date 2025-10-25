import type { DiscordAPIError } from '@discordjs/rest';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import botCache from '../../cache.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import requestHandlerError from '../../requestHandlerError.js';
import { canGetCommands } from './getGlobalCommand.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { makeRequestHandler } from '../../requestHandler.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a guild command by ID from the cache or API.
 * @param guildId The guild ID where the command is located.
 * @param commandId The ID of the command to retrieve.
 * @returns A Promise that resolves with the retrieved command, or rejects with an error.
 */
export default async (guildId: string, commandId: string) => {
 if (!canGetCommands(guildId)) {
  const e = requestHandlerError(
   `Cannot get own Commands. Please make sure you don't have more than 50 Bots in your Server`,
   [],
  );

  error(guildId, e);
  return e;
 }

 if (await hasMissingScopes(guildId)) return [];

 const botId = await getBotIdFromGuild(guildId);

 if (
  botId !== process.env.mainId &&
  !botCache.apis.get(guildId) &&
  !(await makeRequestHandler(guildId))
 ) {
  return new Error('Failed to set up API');
 }

 return (
  (await cache.guildCommands.get(commandId)) ??
  (await getAPI(guildId)).applicationCommands
   .getGuildCommand(botId, guildId, commandId)
   .then((cmd) => {
    cache.guildCommands.set({ ...cmd, guild_id: guildId });
    return cache.guildCommands.apiToR({ ...cmd, guild_id: guildId });
   })
   .catch((e: DiscordAPIError) => {
    setHasMissingScopes(e.message, guildId, botId, process.env.mainId || '');
    error(guildId, e);
    return e;
   })
 );
};
