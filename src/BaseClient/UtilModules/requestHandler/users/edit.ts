import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPICurrentUserJSONBody } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import { resolveImage } from '../../util.js';

/**
 * Edits the current user's profile.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param data - The data to update the user's profile.
 * @returns A promise that resolves with the updated user's profile.
 */
export default async (guildId: string | undefined, data: RESTPatchAPICurrentUserJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).users
  .edit({
   ...data,
   avatar: data.avatar ? await resolveImage(data.avatar) : data.avatar,
  })
  .then((u) => cache.users.apiToR(u))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
