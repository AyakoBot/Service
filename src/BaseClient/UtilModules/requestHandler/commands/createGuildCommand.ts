import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIApplicationGuildCommandsJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import botCache from '../../cache.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';

/**
 * Creates a new guild command for the specified guild.
 * @param guildId The guild ID to create the command for.
 * @param body The JSON body of the command.
 * @param mainId The main bot ID from environment.
 * @returns A promise that resolves with the created command.
 */
export default async (
 guildId: string,
 body: RESTPostAPIApplicationGuildCommandsJSONBody,
 mainId?: string,
) => {
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
  .createGuildCommand(botId, guildId, body)
  .then((cmd) => {
   cache.guildCommands.set({ ...cmd, guild_id: guildId });
   return cache.guildCommands.apiToR({ ...cmd, guild_id: guildId });
  })
  .catch((e: DiscordAPIError) => {
   if (mainId) setHasMissingScopes(e.message, guildId, botId, mainId);
   error(guildId, e);
   return e;
  });
};
