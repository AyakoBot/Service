import {
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';
import { PermissionFlagsBits, type APIInteractionGuildMember } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { getCensoredContent } from '../../../Util/censorContent.js';
import type ConfessionsPlugin from '../Plugin.js';
import { banIsActive } from '../Util/gates.js';
import { deriveIdentity } from '../Util/identity.js';

const dayMs = 86_400_000;

export default class Confessions {
 plugin: ConfessionsPlugin;
 client: Client;

 constructor(plugin: ConfessionsPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 settings = (guildId: string): Promise<ConfessionSetting | null> =>
  this.client.db.client.confessionSetting.findFirst({
   where: { guild: guildId, active: true },
  });

 identityFor = (settings: ConfessionSetting, userId: string): string =>
  deriveIdentity(settings.guild, userId, process.env.CONFESSION_SECRET);

 isBanned = async (guildId: string, identity: string, userId: string): Promise<boolean> => {
  const bans = await this.client.db.client.confessionBan.findMany({
   where: { guild: guildId, identity: { in: [identity, userId] } },
  });
  const now = Date.now();

  return bans.some((ban) => banIsActive(ban, now));
 };

 recentCount = (guildId: string, identity: string): Promise<number> =>
  this.client.db.client.confession.count({
   where: {
    guild: guildId,
    identity,
    parent: null,
    state: { not: ConfessionState.Denied },
    createdAt: { gt: new Date(Date.now() - dayMs) },
   },
  });

 allocateNumber = async (settings: ConfessionSetting): Promise<number> => {
  const row = await this.client.db.client.confessionSetting.update({
   where: { id: settings.id },
   data: { nextNumber: { increment: 1 } },
  });

  return row.nextNumber - 1;
 };

 byId = (id: string): Promise<ConfessionRow | null> =>
  this.client.db.client.confession.findUnique({ where: { id } });

 screen = async (settings: ConfessionSetting, text: string): Promise<string | null> => {
  if (!settings.channel) return null;

  const censored = await getCensoredContent.call(this, settings.guild, text, settings.channel, []);

  return censored === text ? null : censored;
 };

 reviewerAllowed = (
  settings: ConfessionSetting,
  member: APIInteractionGuildMember | undefined,
 ): boolean => {
  if (!member) return false;
  if (settings.reviewerRoles.length) {
   return settings.reviewerRoles.some((role) => member.roles.includes(role));
  }

  return (BigInt(member.permissions ?? '0') & PermissionFlagsBits.ManageMessages) !== 0n;
 };

 blocked = (settings: ConfessionSetting, userId: string, roles: string[]): boolean =>
  settings.blockedUsers.includes(userId) ||
  settings.blockedRoles.some((role) => roles.includes(role));

 claim = async (id: string): Promise<boolean> => {
  const { count } = await this.client.db.client.confession.updateMany({
   where: { id, state: ConfessionState.Pending },
   data: { state: ConfessionState.Posted },
  });

  return count === 1;
 };

 release = async (id: string): Promise<void> => {
  await this.client.db.client.confession.updateMany({
   where: { id, state: ConfessionState.Posted, message: null },
   data: { state: ConfessionState.Pending },
  });
 };

 reject = async (id: string): Promise<boolean> => {
  const { count } = await this.client.db.client.confession.updateMany({
   where: { id, state: ConfessionState.Pending },
   data: { state: ConfessionState.Denied, content: null, media: null },
  });

  return count === 1;
 };

 discard = async (id: string): Promise<void> => {
  await this.client.db.client.confession.deleteMany({ where: { id } });
 };
 remove = async (row: ConfessionRow): Promise<void> => {
  await this.client.db.client.confession.updateMany({
   where: { id: row.id },
   data: { state: ConfessionState.Removed, content: null, media: null },
  });

  if (row.channel && row.message) {
   await this.plugin.schedule.disarmDelete(row.guild, row.channel, row.message);
  }
 };

 removeByMessages = async (guildId: string, ids: string[]): Promise<void> => {
  const rows = await this.client.db.client.confession.findMany({
   where: {
    guild: guildId,
    OR: [
     { state: ConfessionState.Pending, queueMessage: { in: ids } },
     { state: ConfessionState.Posted, message: { in: ids } },
    ],
   },
  });

  await Promise.all(rows.map((row) => this.remove(row)));
 };

 removeThread = async (guildId: string, threadId: string): Promise<void> => {
  const rows = await this.client.db.client.confession.findMany({
   where: { guild: guildId, state: ConfessionState.Posted, channel: threadId },
  });

  await Promise.all(rows.map((row) => this.remove(row)));
  await this.client.db.client.confession.updateMany({
   where: { guild: guildId, thread: threadId, NOT: { channel: threadId } },
   data: { thread: null },
  });
 };
}
