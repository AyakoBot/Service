import { ChannelType } from '@discordjs/core';
import error from '../../error.js';
import { getAPI } from './addReaction.js';
import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../../BaseClient/Client.js';

type Response = Promise<RThread | RChannel | DiscordAPIError>;

/**
 * Retrieves a channel from the cache or the Discord API.
 * @param guildID The guildId that the channel belongs to.
 * @param id The ID of the channel to retrieve.
 * @returns A Promise that resolves with the retrieved channel.
 */
export default async (guildId: string | null | undefined, id: string): Response =>
 (await cache.channels.get(id).then((c) => (!guildId || c.guild_id === guildId ? c : undefined))) ??
 (await getAPI(guildId)).channels
  .get(id)
  .then((channel) => {
   const parsed = Classes.Channel(c, channel, guild);

   if (guild?.channels.cache.get(parsed.id)) return parsed;
   if (![ChannelType.DM, ChannelType.GroupDM].includes(parsed.type)) {
    guild?.channels.cache.set(parsed.id, parsed as RChannel);
   }

   return parsed;
  })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
