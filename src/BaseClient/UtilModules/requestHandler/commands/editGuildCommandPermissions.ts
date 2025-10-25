import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPutAPIApplicationCommandPermissionsJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import botCache from '../../cache.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';

/**
 * Edits the permissions for a command in a guild.
 * @param guildId The guild ID where the command is located.
 * @param userToken The token of the user making the request.
 * @param commandId The ID of the command to edit.
 * @param body The new permissions for the command.
 * @param mainId The main bot ID from environment.
 * @returns A promise that resolves with the updated command permissions
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 userToken: string,
 commandId: string,
 body: RESTPutAPIApplicationCommandPermissionsJSONBody,
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
  .editGuildCommandPermissions(userToken, botId, guildId, commandId, body)
  .then((res) => {
   res.permissions.forEach((perm) => cache.commandPermissions.set(perm, guildId, commandId));
   return res.permissions;
  })
  .catch((e: DiscordAPIError) => {
   if (mainId) setHasMissingScopes(e.message, guildId, botId, mainId);
   error(guildId, e);
   return e;
  });
};
