import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the current user for the given guild.
 * @param guild - The guild to get the current user for.
 * @param client - The client to use if guild is not defined.
 * @returns A promise that resolves with a new instance of the ClientUser class
 * representing the current user, or rejects with a DiscordAPIError if an error occurs.
 */
function fn(
 guild: undefined | null | RGuild,
 client: Discord.Client<true>,
): Promise<Discord.ClientUser | DiscordAPIError>;
function fn(
 guild: RGuild,
 client?: undefined,
): Promise<Discord.ClientUser | DiscordAPIError>;
async function fn(
 guild: undefined | null | RGuild,
 client?: Discord.Client<true>,
): Promise<Discord.ClientUser | DiscordAPIError> {
 const c = (guild?.client ?? client)!;

 return (await getAPI(guild)).users
  .getCurrent()
  .then((u) => new Classes.ClientUser(c, u))
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
}

export default fn;
