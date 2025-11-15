import type { DiscordAPIError } from '@discordjs/rest';
import {
 ChannelType,
 OverwriteType,
 PermissionFlagsBits,
 type RESTPostAPIGuildChannelJSONBody,
 type RESTPatchAPIChannelJSONBody,
 type APIGuildChannel,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import edit from '../channels/edit.js';
import del from '../channels/delete.js';
import type { RChannelTypes } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';

/**
 * Checks if a permission bitfield has a specific permission flag.
 * @param bitfield - The permission bitfield as a bigint or string
 * @param flag - The permission flag to check
 * @returns True if the permission is present
 */
const hasPermission = (bitfield: bigint | string, flag: bigint): boolean => {
 const bits = typeof bitfield === 'string' ? BigInt(bitfield) : bitfield;
 return (bits & flag) === flag;
};

/**
 * Creates a new channel in the specified guild.
 * @param guildId The guild ID where the channel will be created.
 * @param body The channel data to be sent to the API.
 * @param reason The reason for creating the channel.
 * @returns A promise that resolves with the created channel or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIGuildChannelJSONBody, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const me = await getBotMemberFromGuild(guildId);
 const guild = await cache.guilds.get(guildId);
 if (!guild) return new Error('Guild not found');

 const hasAdminPermission = await checkPermissions(guildId, ['Administrator'], me.user_id);

 const needs2Steps =
  !hasAdminPermission &&
  body.permission_overwrites?.some((p) =>
   p.allow ? hasPermission(BigInt(p.allow), PermissionFlagsBits.ManageRoles) : false,
  ) &&
  body.parent_id &&
  (await (async () => {
   const parentChannel = await cache.channels.get(String(body.parent_id));
   if (!parentChannel || parentChannel.type !== ChannelType.GuildCategory) return false;

   const overwrite = parentChannel.permission_overwrites?.find((o) => o.id === me.user_id);
   if (!overwrite) return false;

   return hasPermission(BigInt(overwrite.allow ?? 0n), PermissionFlagsBits.ManageRoles);
  })());

 if (!(await canCreateChannel(guildId, body, me.user_id))) {
  const e = requestHandlerError(`Cannot create channel`, [PermissionFlagsBits.ManageChannels]);

  if (
   body.permission_overwrites?.some((p) =>
    hasPermission(BigInt(p.allow ?? 0n), PermissionFlagsBits.ManageRoles),
   ) &&
   !needs2Steps
  ) {
   e.message += `\n${requestHandlerError('Permissions in the parent channel', [PermissionFlagsBits.ManageRoles]).message}`;
  }

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .createChannel(guildId, needs2Steps ? { ...body, permission_overwrites: [] } : body, { reason })
  .then(async (c) => {
   const channel = cache.channels.apiToR(c as APIGuildChannel<RChannelTypes>);
   if (!channel) return new Error('Failed to convert channel');
   if (!needs2Steps) return channel;

   const editRes = await edit(channel, {
    permission_overwrites: [
     ...(body.permission_overwrites as RESTPatchAPIChannelJSONBody['permission_overwrites'])!,
     {
      id: me.user_id,
      type: OverwriteType.Member,
      allow: String(
       channel.permission_overwrites?.find(
        (o: { id: string; allow?: string | bigint }) => o.id === me.user_id,
       )?.allow ?? 0n,
      ),
     },
    ],
   });

   if (editRes instanceof Error) {
    del(channel);
    return editRes;
   }
   return editRes;
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions
 * to create a channel with the specified properties.
 * @param guildId - The guild ID.
 * @param body - The JSON body containing the properties of the channel to be created.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member can create the channel.
 */
export const canCreateChannel = async (
 guildId: string,
 body: RESTPostAPIGuildChannelJSONBody,
 userId: string,
) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;

 if (guild.owner_id === userId) return true;

 const hasAdminPermission = await checkPermissions(guildId, ['Administrator'], userId);
 if (hasAdminPermission) return true;

 const hasManageChannels = await checkPermissions(guildId, ['ManageChannels'], userId);
 if (!hasManageChannels) return false;

 if (!body.permission_overwrites) return true;

 const hasManageRoles = await checkPermissions(guildId, ['ManageRoles'], userId);
 if (!hasManageRoles) return false;

 // Check all permissions being set in overwrites
 for (const overwrite of body.permission_overwrites) {
  const allowPerms = BigInt(overwrite.allow ?? 0n);

  // If trying to set ManageRoles permission, need ManageRoles in parent category
  if (hasPermission(allowPerms, PermissionFlagsBits.ManageRoles) && body.parent_id) {
   const hasManageRolesInParent = await checkChannelPermissions(
    guildId,
    String(body.parent_id),
    ['ManageRoles'],
    userId,
   );

   if (!hasManageRolesInParent) return false;
  }
 }

 return true;
};
