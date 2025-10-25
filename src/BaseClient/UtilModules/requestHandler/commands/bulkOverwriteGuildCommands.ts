import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPutAPIApplicationGuildCommandsJSONBody } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import botCache from '../../cache.js';
import DataBase from '../../../DataBase.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Overwrites all existing global commands for this application in this guild.
 * @param guildId - The guild ID to overwrite the commands for.
 * @param body - The commands to overwrite.
 * @param mainId - The main bot ID from environment.
 * @returns A promise that resolves with an array of the newly created application commands.
 */
export default async (
 guildId: string,
 body: RESTPutAPIApplicationGuildCommandsJSONBody,
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

 if (
  mainId &&
  botId !== mainId &&
  !botCache.apis.get(guildId) &&
  !(await makeRequestHandler(guildId))
 ) {
  return new Error('Failed to set up API');
 }

 return (await getAPI(guildId)).applicationCommands
  .bulkOverwriteGuildCommands(botId, guildId, body)
  .then((cmds) => {
   cache.guildCommands
    .getAll(guildId, botId)
    .then((cmds) => cache.guildCommands.del(...cmds.map((c) => c.id)))
    .then(() => cmds.map((c) => cache.guildCommands.set({ ...c, guild_id: guildId })));

   return cmds.map((cmd) => cache.guildCommands.apiToR({ ...cmd, guild_id: guildId }));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   if (mainId) setHasMissingScopes(e.message, guildId, botId, mainId);
   return e;
  });
};

/**
 * Checks if a guild has missing scopes for commands.
 * @param guildId - The guild ID to check.
 * @returns A promise that resolves to the guild with missing scopes,
 * or undefined if no guild is found.
 */
export const hasMissingScopes = (guildId: string) =>
 DataBase.noCommandsGuilds.findUnique({
  where: { guildId },
 });

/**
 * Sets the "hasMissingScopes" flag for a guild if the error message includes "Missing Access".
 * @param err - The error message.
 * @param guildId - The guild ID.
 * @param botId - The bot ID.
 * @param mainId - The main bot ID.
 */
export const setHasMissingScopes = async (
 err: string,
 guildId: string,
 botId: string,
 mainId: string,
) => {
 if (!err.includes('Missing Access')) return;
 if (botId !== mainId) return;

 DataBase.noCommandsGuilds.upsert({ where: { guildId }, create: { guildId }, update: {} }).then();
};
