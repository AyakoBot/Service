import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { ChannelType } from 'discord-api-types/v10.js';

/**
 * Retrieves all channels in a guild and returns them as an array of parsed Channel objects.
 * If the channels are already cached, they are not added again.
 * @param guildId - The guild to retrieve channels from.
 * @returns A Promise that resolves with an array of parsed Channel objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getChannels(guildId)
  .then((channels) => {
   channels.forEach((c) =>
    [ChannelType.AnnouncementThread, ChannelType.PublicThread, ChannelType.PrivateThread].includes(
     c.type,
    )
     ? cache.threads.set(c as Parameters<typeof cache.threads.set>[0])
     : cache.channels.set(c as Parameters<typeof cache.channels.set>[0]),
   );

   return channels.map((c) =>
    [ChannelType.AnnouncementThread, ChannelType.PublicThread, ChannelType.PrivateThread].includes(
     c.type,
    )
     ? cache.threads.apiToR(c as Parameters<typeof cache.threads.apiToR>[0])
     : cache.channels.apiToR(c as Parameters<typeof cache.channels.apiToR>[0]),
   );
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
