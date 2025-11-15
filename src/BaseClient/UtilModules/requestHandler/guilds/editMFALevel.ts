import type { DiscordAPIError } from '@discordjs/rest';
import type { GuildMFALevel } from 'discord-api-types/v10.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits the MFA level of a guild.
 * @param guildId The guild ID to edit the MFA level of.
 * @param level The new MFA level to set.
 * @param reason The reason for editing the MFA level.
 * @returns A promise that resolves with the edited guild if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, level: GuildMFALevel, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditMFALevel(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit MFA level`, []);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editMFALevel(guildId, level, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the specified guild member has permission to edit the MFA level of the guild.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member can edit the MFA level.
 */
export const canEditMFALevel = async (guildId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 return guild.owner_id === userId;
};
