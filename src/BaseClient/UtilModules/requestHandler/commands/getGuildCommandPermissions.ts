import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import botCache from '../../cache.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import requestHandlerError from '../../requestHandlerError.js';
import { canGetCommands } from './getGlobalCommand.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { makeRequestHandler } from '../../requestHandler.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the permissions for a specific command in a guild.
 * @param guildId - The guild ID where the command is located.
 * @param commandId - The ID of the command to retrieve permissions for.
 * @returns A promise that resolves with the command permissions, or rejects with a DiscordAPIError.
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

 return (await getAPI(guildId)).applicationCommands
  .getGuildCommandPermissions(botId, guildId, commandId)
  .then((res) => {
   res.permissions.forEach((perm) => cache.commandPermissions.set(perm, guildId, commandId));
   return res.permissions;
  })
  .catch((e: DiscordAPIError) => {
   setHasMissingScopes(e.message, guildId, botId, process.env.mainId || '');
   error(guildId, e);
   return e;
  });
};
