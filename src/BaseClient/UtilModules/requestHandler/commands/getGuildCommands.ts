import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIApplicationGuildCommandsQuery } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import botCache from '../../cache.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { canGetCommands } from './getGlobalCommand.js';

/**
 * Retrieves the guild commands for a given guild.
 * @param guildId The guild ID to retrieve the commands for.
 * @param query Optional query parameters to include in the request.
 * @returns A Promise that resolves with an array of parsed ApplicationCommand objects.
 */
export default async (guildId: string, query?: RESTGetAPIApplicationGuildCommandsQuery) => {
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

 return (await getAPI(guildId)).applicationCommands
  .getGuildCommands(botId, guildId, query)
  .then((cmds) => cmds.map((cmd) => cache.guildCommands.apiToR({ ...cmd, guild_id: guildId })))
  .catch((e: DiscordAPIError) => {
   setHasMissingScopes(e.message, guildId, botId, process.env.mainId || '');
   error(guildId, e);
   return e;
  });
};
