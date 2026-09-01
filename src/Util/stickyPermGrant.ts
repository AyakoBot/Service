import type Client from '../Classes/Client.js';

export interface StickyPermTarget {
 guildId: string;
 userId: string;
 channelId: string;
}

export interface StickyPermBits extends StickyPermTarget {
 allow: string;
 deny: string;
}

const permWhere = (opts: StickyPermTarget) => ({
 guild: opts.guildId,
 user: opts.userId,
 channel: opts.channelId,
});

const permsEnabled = async function (this: Client, guildId: string): Promise<boolean> {
 const settings = await this.db.client.stickyRoleSettings.findUnique({
  where: { guild: guildId },
  select: { permsActive: true },
 });

 return !!settings?.permsActive;
};

export const stageStickyPerm = async function (
 this: Client,
 opts: StickyPermBits,
): Promise<boolean> {
 if (!(await permsEnabled.call(this, opts.guildId))) return false;

 await this.db.client.stickyPermMember.upsert({
  where: { guild_user_channel: permWhere(opts) },
  create: { ...permWhere(opts), allow: opts.allow, deny: opts.deny },
  update: { allow: opts.allow, deny: opts.deny, takenAt: new Date() },
 });

 return true;
};

export const clearStickyPerm = async function (
 this: Client,
 opts: StickyPermTarget,
): Promise<boolean> {
 if (!(await permsEnabled.call(this, opts.guildId))) return false;

 await this.db.client.stickyPermMember.deleteMany({ where: permWhere(opts) });

 return true;
};
