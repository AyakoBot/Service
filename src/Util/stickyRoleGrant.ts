import { StickyRoleMode, StickyRoleSource } from '@ayako/database';

import type Client from '../Classes/Client.js';

export interface StickyRoleGrantOptions {
 guildId: string;
 userId: string;
 roles: string[];
}

export interface StickyRoleStaged {
 staged: string[];
 skipped: string[];
}

export interface StickyRoleUnstaged {
 removed: string[];
}

export const filterStickyRoles = (
 mode: StickyRoleMode,
 configured: string[],
 roles: string[],
): StickyRoleStaged => {
 const sticky = (roleId: string) =>
  (mode === StickyRoleMode.include ? configured.includes(roleId) : !configured.includes(roleId));

 const unique = [...new Set(roles)];

 return {
  staged: unique.filter((roleId) => sticky(roleId)),
  skipped: unique.filter((roleId) => !sticky(roleId)),
 };
};

const scheduledWhere = (opts: { guildId: string; userId: string }) => ({
 guild: opts.guildId,
 user: opts.userId,
 source: StickyRoleSource.scheduled,
});

export const stageStickyRoleGrant = async function (
 this: Client,
 opts: StickyRoleGrantOptions,
): Promise<StickyRoleStaged | null> {
 const settings = await this.db.client.stickyRoleSettings.findUnique({
  where: { guild: opts.guildId },
  select: { active: true, filterMode: true, roles: true },
 });
 if (!settings?.active) return null;

 const { staged, skipped } = filterStickyRoles(settings.filterMode, settings.roles, opts.roles);
 if (!staged.length) return { staged, skipped };

 const existing = await this.db.client.stickyRoleMember.findUnique({
  where: { guild_user_source: scheduledWhere(opts) },
  select: { roles: true },
 });

 await this.db.client.stickyRoleMember.upsert({
  where: { guild_user_source: scheduledWhere(opts) },
  create: { ...scheduledWhere(opts), roles: staged },
  update: { roles: [...new Set([...(existing?.roles ?? []), ...staged])] },
 });

 return { staged, skipped };
};

export const unstageStickyRoleGrant = async function (
 this: Client,
 opts: StickyRoleGrantOptions,
): Promise<StickyRoleUnstaged | null> {
 const settings = await this.db.client.stickyRoleSettings.findUnique({
  where: { guild: opts.guildId },
  select: { active: true },
 });
 if (!settings?.active) return null;

 const existing = await this.db.client.stickyRoleMember.findUnique({
  where: { guild_user_source: scheduledWhere(opts) },
  select: { roles: true },
 });
 if (!existing) return { removed: [] };

 const removed = existing.roles.filter((roleId) => opts.roles.includes(roleId));
 if (!removed.length) return { removed };

 const remaining = existing.roles.filter((roleId) => !opts.roles.includes(roleId));

 if (remaining.length) {
  await this.db.client.stickyRoleMember.update({
   where: { guild_user_source: scheduledWhere(opts) },
   data: { roles: remaining },
  });
 } else {
  await this.db.client.stickyRoleMember.deleteMany({ where: scheduledWhere(opts) });
 }

 return { removed };
};
