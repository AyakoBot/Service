import * as Discord from 'discord.js';
import { api } from '../../../Client.js';
import { guild as getBotIdFromGuild } from '../../getBotIdFrom.js';
import cache from '../../cache.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';

/**
 * Creates a global command for the given guild.
 * @param guild - The guild to create the command for.
 * @param body - The REST API JSON body for the command.
 * @returns A Promise that resolves with the created ApplicationCommand object,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guild: RGuild,
 body: Discord.RESTPostAPIApplicationCommandsJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (cache.apis.get(guild.id) ?? API).applicationCommands
  .createGlobalCommand(await getBotIdFromGuild(guild), body)
  .then((cmd) => {
   const parsed = new Classes.ApplicationCommand(guild.client, cmd);
   if (!cache.commands.cache.get(guild.id)) cache.commands.cache.set(guild.id, new Map());
   cache.commands.cache.get(guild.id)?.set(parsed.id, parsed);

   if (cache.apis.get(guild.id)) return parsed;
   guild.client.application.commands.cache.set(parsed.id, parsed);
   return parsed;
  })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};
