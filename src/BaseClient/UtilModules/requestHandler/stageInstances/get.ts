import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves the stage instance associated with the given stage channel.
 * @param guildId - The guild ID where the stage channel is located.
 * @param channelId - The ID of the stage channel to retrieve the stage instance for.
 * @returns A promise that resolves with the stage instance, or rejects with an error.
 */
export default async (guildId: string, channelId: string) =>
 (await getAPI(guildId)).stageInstances
  .get(channelId)
  .then((s) => cache.stages.apiToR(s))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
