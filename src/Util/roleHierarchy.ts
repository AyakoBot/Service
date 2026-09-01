import { getGuildPerms } from '@ayako/utility';
import { PermissionFlagsBits } from '@discordjs/core';

import type Client from '../Classes/Client.js';

export enum RoleWriteVerdict {
 Ok = 'ok',
 Missing = 'missing',
 Everyone = 'everyone',
 Managed = 'managed',
 AboveBot = 'above-bot',
 AboveExecutor = 'above-executor',
 BotMissingPermission = 'bot-missing-permission',
}

export const NO_ROLE_POSITION = -1;

export interface RoleSource {
 id: string;
 position: number;
 managed: boolean;
 permissions: string;
}

export interface RoleIndexEntry {
 position: number;
 managed: boolean;
}

export type RoleIndex = Map<string, RoleIndexEntry>;

export interface BotRoleContext {
 position: number | null;
 canManageRoles: boolean;
}

export interface GuildRoleContext {
 index: RoleIndex;
 bot: BotRoleContext;
}

export interface RoleVerdictContext {
 guildId: string;
 roleId: string;
 index: RoleIndex;
 bot: BotRoleContext;
 executorPosition?: number;
 executorIsOwner?: boolean;
 allowManaged?: boolean;
}

export interface RolePartitionContext extends Omit<RoleVerdictContext, 'roleId'> {
 roleIds: string[];
 heldByTarget?: string[];
}

export interface RolePartition {
 ok: string[];
 rejected: Map<string, RoleWriteVerdict>;
}

export interface ExecutorOptions {
 guildId: string;
 executorId?: string;
 executorRoleIds?: string[];
}

export interface CheckRoleWritableOptions extends ExecutorOptions {
 roleId: string;
 botId: string;
 allowManaged?: boolean;
}

export interface FilterWritableRolesOptions extends ExecutorOptions {
 roleIds: string[];
 botId: string;
 heldByTarget?: string[];
}

const hasManageRoles = (permissions: bigint): boolean =>
 (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator ||
 (permissions & PermissionFlagsBits.ManageRoles) === PermissionFlagsBits.ManageRoles;

export const roleIndexFrom = (roles: RoleSource[]): RoleIndex =>
 new Map(roles.map((role) => [role.id, { position: role.position, managed: role.managed }]));

export const highestPositionIn = (index: RoleIndex, roleIds: string[]): number =>
 roleIds.reduce(
  (highest, roleId) => Math.max(highest, index.get(roleId)?.position ?? NO_ROLE_POSITION),
  NO_ROLE_POSITION,
 );

export const resolveRoleVerdict = (ctx: RoleVerdictContext): RoleWriteVerdict => {
 if (ctx.roleId === ctx.guildId) return RoleWriteVerdict.Everyone;

 const role = ctx.index.get(ctx.roleId);
 if (!role) return RoleWriteVerdict.Missing;

 if (!ctx.bot.canManageRoles) return RoleWriteVerdict.BotMissingPermission;
 if (role.managed && !ctx.allowManaged) return RoleWriteVerdict.Managed;
 if (ctx.bot.position === null || role.position >= ctx.bot.position) {
  return RoleWriteVerdict.AboveBot;
 }

 if (
  ctx.executorPosition !== undefined &&
  !ctx.executorIsOwner &&
  role.position >= ctx.executorPosition
 ) {
  return RoleWriteVerdict.AboveExecutor;
 }

 return RoleWriteVerdict.Ok;
};

export const partitionRoles = (ctx: RolePartitionContext): RolePartition => {
 const ok: string[] = [];
 const rejected = new Map<string, RoleWriteVerdict>();

 ctx.roleIds.forEach((roleId) => {
  const verdict = resolveRoleVerdict({ ...ctx, roleId });
  const held = verdict === RoleWriteVerdict.AboveBot && !!ctx.heldByTarget?.includes(roleId);

  if (verdict === RoleWriteVerdict.Ok || held) ok.push(roleId);
  else rejected.set(roleId, verdict);
 });

 return { ok, rejected };
};

export const roleWriteContext = async function (
 this: Client,
 guildId: string,
 botId: string,
): Promise<GuildRoleContext> {
 const [roles, member, perms] = await Promise.all([
  this.cache.roles.getAll(guildId),
  this.cache.members.get(guildId, botId),
  getGuildPerms.call(this.cache, guildId, botId),
 ]);

 const index = roleIndexFrom(roles);
 const position = member ? highestPositionIn(index, member.roles) : NO_ROLE_POSITION;

 return {
  index,
  bot: {
   position: position === NO_ROLE_POSITION ? null : position,
   canManageRoles: hasManageRoles(perms.response),
  },
 };
};

export const botHighestPosition = async function (
 this: Client,
 guildId: string,
 botId: string,
): Promise<number | null> {
 const { bot } = await roleWriteContext.call(this, guildId, botId);
 return bot.position;
};

export const highestPositionOf = async function (
 this: Client,
 guildId: string,
 roleIds: string[],
): Promise<number> {
 const roles = await this.cache.roles.getAll(guildId);
 return highestPositionIn(roleIndexFrom(roles), roleIds);
};

const resolveExecutor = async function (
 this: Client,
 opts: ExecutorOptions,
 index: RoleIndex,
): Promise<{ position?: number; isOwner: boolean }> {
 if (!opts.executorId && !opts.executorRoleIds) return { isOwner: false };

 const guild = opts.executorId ? await this.cache.guilds.get(opts.guildId) : null;
 if (guild && opts.executorId === guild.owner_id) {
  return { position: NO_ROLE_POSITION, isOwner: true };
 }

 const member =
  !opts.executorRoleIds && opts.executorId
   ? await this.cache.members.get(opts.guildId, opts.executorId)
   : null;

 return {
  position: highestPositionIn(index, opts.executorRoleIds ?? member?.roles ?? []),
  isOwner: false,
 };
};

export const checkRoleWritable = async function (
 this: Client,
 opts: CheckRoleWritableOptions,
): Promise<RoleWriteVerdict> {
 const { index, bot } = await roleWriteContext.call(this, opts.guildId, opts.botId);
 const executor = await resolveExecutor.call(this, opts, index);

 return resolveRoleVerdict({
  guildId: opts.guildId,
  roleId: opts.roleId,
  index,
  bot,
  executorPosition: executor.position,
  executorIsOwner: executor.isOwner,
  allowManaged: opts.allowManaged,
 });
};

export const filterWritableRoles = async function (
 this: Client,
 opts: FilterWritableRolesOptions,
): Promise<RolePartition> {
 const { index, bot } = await roleWriteContext.call(this, opts.guildId, opts.botId);
 const executor = await resolveExecutor.call(this, opts, index);

 return partitionRoles({
  guildId: opts.guildId,
  roleIds: opts.roleIds,
  index,
  bot,
  executorPosition: executor.position,
  executorIsOwner: executor.isOwner,
  heldByTarget: opts.heldByTarget,
 });
};
