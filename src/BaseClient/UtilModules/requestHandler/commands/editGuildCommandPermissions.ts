import * as Discord from 'discord.js';
import { api } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import cache from '../../cache.js';
import error from '../../error.js';
import requestHandlerError from '../../requestHandlerError.js';
import { canGetCommands } from './getGlobalCommand.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { makeRequestHandler } from '../../requestHandler.js';

/**
 * Edits the permissions for a command in a guild.
 * @param guild The guild where the command is located.
 * @param userToken The token of the user making the request.
 * @param commandId The ID of the command to edit.
 * @param body The new permissions for the command.
 * @returns A promise that resolves with the updated command permissions
 * or rejects with a DiscordAPIError.
 */
export default async (
 guild: RGuild,
 userToken: string,
 commandId: string,
 body: Discord.RESTPutAPIApplicationCommandPermissionsJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');
 if (!canGetCommands(guild)) {
  const e = requestHandlerError(
   `Cannot get own Commands. Please make sure you don't have more than 50 Bots in your Server`,
   [],
  );

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 if (await hasMissingScopes(guild)) return [];

 if (
  (await getBotIdFromGuild(guild)) !== guild.client.user.id &&
  !cache.apis.get(guild.id) &&
  !(await makeRequestHandler(guild))
 ) {
  return new Error('Failed to set up API');
 }

 return (cache.apis.get(guild.id) ?? API).applicationCommands
  .editGuildCommandPermissions(userToken, await getBotIdFromGuild(guild), guild.id, commandId, body)
  .then((res) => {
   cache.commandPermissions.set(guild.id, commandId, res.permissions);
   return res.permissions;
  })
  .catch((e: DiscordAPIError) => {
   setHasMissingScopes(e.message, guild);

   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};
