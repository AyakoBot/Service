import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the voice regions for a given guild.
 * @param guild - The guild to retrieve the voice regions for.
 * @returns A promise that resolves with an array of voice regions for the guild.
 */
export default async (guild: RGuild) =>
 (await getAPI(guild)).guilds
  .getVoiceRegions(guild.id)
  .then((voiceRegions) => voiceRegions.map((vR) => new Classes.VoiceRegion(vR)))
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
