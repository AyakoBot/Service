import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import botCache from '../../cache.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import requestHandlerError from '../../requestHandlerError.js';
import { canGetCommands } from './getGlobalCommand.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { makeRequestHandler } from '../../requestHandler.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the permissions for all the slash commands in a guild.
 * @param guildId - The guild ID to retrieve the permissions for.
 * @returns A promise that resolves to the permissions for all the slash commands in the guild.
 */
export default async (guildId: string) => {
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
  .getGuildCommandsPermissions(botId, guildId)
  .then((res) => {
   res.forEach((r) =>
    r.permissions.forEach((perm) => cache.commandPermissions.set(perm, guildId, r.id)),
   );

   return res;
  })
  .catch((e: DiscordAPIError) => {
   setHasMissingScopes(e.message, guildId, botId, process.env.mainId || '');
   error(guildId, e);
   return e;
  });
};
