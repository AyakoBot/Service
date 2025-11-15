import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildJSONBody, GuildFeature } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import { resolveImage } from '../../util.js';

/**
 * Edits a guild.
 * @param guildId The guild ID to edit.
 * @param body The data to edit the guild with.
 * @returns A promise that resolves with the edited guild.
 */
export default async (guildId: string, body: RESTPatchAPIGuildJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEdit(guildId, body, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit guild ${guildId}`, [PermissionFlagsBits.ManageGuild]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .edit(guildId, {
   ...body,
   icon: body.icon ? await resolveImage(body.icon) : body.icon,
   splash: body.splash ? await resolveImage(body.splash) : body.splash,
   banner: body.banner ? await resolveImage(body.banner) : body.banner,
   discovery_splash: body.discovery_splash
    ? await resolveImage(body.discovery_splash)
    : body.discovery_splash,
  })
  .then((g) => cache.guilds.apiToR(g))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit the guild.
 * @param guildId - The guild ID being edited.
 * @param body - The JSON body containing the changes to be made.
 * @param userId - The user ID performing the edit.
 * @returns A boolean indicating whether the guild member can edit the guild.
 */
export const canEdit = async (guildId: string, body: RESTPatchAPIGuildJSONBody, userId: string) => {
 if (!(await checkPermissions(guildId, ['ManageGuild'], userId))) return false;

 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;

 const hasCommunity = guild.features.includes('COMMUNITY' as GuildFeature);
 const willHaveCommunity = body.features?.includes('COMMUNITY' as GuildFeature);

 if (hasCommunity !== willHaveCommunity) {
  return checkPermissions(guildId, ['Administrator'], userId);
 }

 return true;
};
