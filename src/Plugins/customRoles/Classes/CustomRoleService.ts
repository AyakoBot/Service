import { RequestHandlerError } from '@ayako/api';
import type { CustomRole } from '@ayako/database';
import type { GatewayGuildMemberUpdateDispatchData } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { memberDiff } from '../../../Util/memberDiff.js';
import { RoleWritePriority } from '../../../Util/roleWriteQueue.js';
import { CustomRolesReason, origin } from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
import { truncateShared } from '../Util/eligibility.js';

export default class CustomRoleService {
 plugin: CustomRolesPlugin;
 client: Client;

 constructor(plugin: CustomRolesPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 rowFor = async (guildId: string, userId: string): Promise<CustomRole | null> =>
  this.client.db.client.customRole.findUnique({
   where: { guild_user: { guild: guildId, user: userId } },
  });

 revoke = async (guildId: string, userId: string, reason: CustomRolesReason): Promise<boolean> => {
  const row = await this.rowFor(guildId, userId);
  if (!row) return false;

  const api = await this.plugin.getAPI(guildId);
  const res = await api.guilds.deleteRole(guildId, row.role, { origin, reason });

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, 'customRoles.revoke');
   return false;
  }

  await this.client.db.client.customRole.deleteMany({ where: { guild: guildId, user: userId } });
  return true;
 };

 onMemberLeave = async (guildId: string, userId: string): Promise<void> => {
  await this.revoke(guildId, userId, CustomRolesReason.OwnerLeft);
  await this.pruneShared(guildId, userId);
 };

 pruneShared = async (guildId: string, userId: string): Promise<void> => {
  const rows = await this.client.db.client.customRole.findMany({
   where: { guild: guildId, shared: { has: userId } },
  });

  await Promise.all(
   rows.map((row) =>
    this.client.db.client.customRole.updateMany({
     where: { guild: guildId, user: row.user },
     data: { shared: row.shared.filter((id) => id !== userId) },
    }),
   ),
  );
 };

 stripSharedRoles = async (data: GatewayGuildMemberUpdateDispatchData): Promise<void> => {
  const diff = await memberDiff.call(this.client, data);
  if (!diff.rolesChanged) return;

  const userId = data.user.id;
  const rows = await this.client.db.client.customRole.findMany({
   where: { guild: data.guild_id, role: { in: data.roles } },
  });

  const remove = rows
   .filter((row) => row.user !== userId && !row.shared.includes(userId))
   .map((row) => row.role);

  if (!remove.length) return;

  this.client.roleWrites.enqueue({
   guildId: data.guild_id,
   userId,
   remove,
   reason: CustomRolesReason.PrivilegeLost,
   priority: RoleWritePriority.Automation,
  });
 };

 onRoleDeleted = async (guildId: string, roleId: string): Promise<void> => {
  await this.client.db.client.customRole.deleteMany({ where: { guild: guildId, role: roleId } });
 };

 enforceShareCap = async (guildId: string, userId: string, maxShare: number): Promise<void> => {
  const row = await this.rowFor(guildId, userId);
  if (!row?.shared.length) return;

  const { kept, dropped } = truncateShared(row.shared, maxShare);
  if (!dropped.length) return;

  await this.client.db.client.customRole.updateMany({
   where: { guild: guildId, user: userId },
   data: { shared: kept },
  });

  dropped.forEach((claimant) =>
   this.client.roleWrites.enqueue({
    guildId,
    userId: claimant,
    remove: [row.role],
    reason: CustomRolesReason.PrivilegeLost,
    priority: RoleWritePriority.Automation,
   }),
  );
 };
}
