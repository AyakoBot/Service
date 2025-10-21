import * as Discord from 'discord.js';
import { api } from '../../../Client.js';
import cache from '../../cache.js';
import error from '../../error.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import { makeRequestHandler } from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { canGetCommands } from './getGlobalCommand.js';

/**
 * Deletes a guild command from the Discord API and removes it from the guild's command cache.
 * @param guild The guild where the command is located.
 * @param commandId The ID of the command to be deleted.
 * @returns A promise that resolves when the command is successfully deleted,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guild: RGuild, commandId: string) => {
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
  .deleteGuildCommand(await getBotIdFromGuild(guild), guild.id, commandId)
  .then(() => {
   cache.commands.delete(guild.id, commandId);
   guild.commands.cache.delete(commandId);
  })
  .catch((e: DiscordAPIError) => {
   setHasMissingScopes(e.message, guild);

   if (JSON.stringify(e).includes('Unknown application command')) {
    cache.commands.delete(guild.id, commandId);
    guild.commands.cache.delete(commandId);
    return true;
   }

   error(guild, new Error((e as DiscordAPIError).message));

   return e;
  });
};
