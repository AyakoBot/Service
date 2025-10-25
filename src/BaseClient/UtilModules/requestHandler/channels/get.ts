import type { DiscordAPIError } from '@discordjs/rest';
import { ChannelType, type APIGuildChannel, type APIThreadChannel } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from './addReaction.js';
import type { RChannelTypes } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';

/**
 * Retrieves a channel from the cache or the Discord API.
 * @param guildId The guildId that the channel belongs to.
 * @param id The ID of the channel to retrieve.
 * @returns A Promise that resolves with the retrieved channel.
 */
export default async (guildId: string | null | undefined, id: string) => {
 const cached = await cache.channels.get(id);
 if (cached && (!guildId || cached.guild_id === guildId)) return cached;

 const cachedThread = await cache.threads.get(id);
 if (cachedThread && (!guildId || cachedThread.guild_id === guildId)) return cachedThread;

 return (await getAPI(guildId)).channels
  .get(id)
  .then((channel) => {
   const isThread = [
    ChannelType.PrivateThread,
    ChannelType.PublicThread,
    ChannelType.AnnouncementThread,
   ].includes(channel.type);

   if (isThread) cache.threads.set(channel as APIThreadChannel);
   else cache.channels.set(channel as APIGuildChannel<RChannelTypes>);

   return isThread
    ? cache.threads.apiToR(channel as APIThreadChannel)
    : cache.channels.apiToR(channel as APIGuildChannel<RChannelTypes>);
  })
  .catch((e: DiscordAPIError) => {
   if (guildId) error(guildId, e);
   return e;
  });
};
