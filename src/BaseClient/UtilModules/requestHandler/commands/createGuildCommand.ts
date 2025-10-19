import * as Discord from 'discord.js';
import { API } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import cache from '../../cache.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';
import requestHandlerError from '../../requestHandlerError.js';
import { canGetCommands } from './getGlobalCommand.js';
import { hasMissingScopes, setHasMissingScopes } from './bulkOverwriteGuildCommands.js';
import { makeRequestHandler } from '../../requestHandler.js';

/**
 * Creates a new guild command for the specified guild.
 * @param guild The guild to create the command for.
 * @param body The JSON body of the command.
 * @returns A promise that resolves with the created command.
 */
export default async (
 guild: Discord.Guild,
 body: Discord.RESTPostAPIApplicationGuildCommandsJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');
 if (!canGetCommands(guild)) {
  const e = requestHandlerError(
   `Cannot get own Commands. Please make sure you don't have more than 50 Bots in your Server`,
   [],
  );

  error(guild, new Error((e as Discord.DiscordAPIError).message));
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
  .createGuildCommand(await getBotIdFromGuild(guild), guild.id, body)
  .then((cmd) => {
   const parsed = new Classes.ApplicationCommand(guild.client, cmd, guild, guild.id);
   if (!cache.commands.cache.get(guild.id)) cache.commands.cache.set(guild.id, new Map());
   cache.commands.cache.get(guild.id)?.set(parsed.id, parsed);

   if (cache.apis.get(guild.id)) return parsed;
   guild.commands.cache.set(cmd.id, parsed);
   return parsed;
  })
  .catch((e: Discord.DiscordAPIError) => {
   setHasMissingScopes(e.message, guild);
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};
