import { RequestHandlerError } from '@ayako/api';
import type { RoleReward } from '@ayako/database';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { ButtonStyle } from '@discordjs/core';
import type { APIMessageTopLevelComponent } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { commandMentions } from '../../../Util/commandMention.js';
import { mintId } from '../../../Util/mintId.js';
import { NO_ROLE_POSITION, roleIndexFrom } from '../../../Util/roleHierarchy.js';
import {
 arm,
 dataKey,
 disarm,
 isArmed,
 scanDataKeys,
 stripDataPrefix,
 stripMarkerPrefix,
} from '../../../Util/schedule.js';
import {
 CustomRolesKey,
 CustomRolesReason,
 origin,
 reconcileChunkDelaySeconds,
 reconcileChunkSize,
} from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
import type { CustomRolesTranslator } from '../Plugin.js';
import {
 applyingRows,
 passesGates,
 DigestAction,
 mergeCapabilities,
 planDigest,
 revokeFor,
 selectAnchorRole,
 type DigestPlan,
 type RewardCapabilities,
} from '../Util/eligibility.js';

import { CustomRolesRoute } from './Routes.js';

const reconcilePrefix = `${CustomRolesKey.Reconcile}:`;
const notifyReason = 'Notifying a member of a newly unlocked role reward';

export default class RolePerks {
 plugin: CustomRolesPlugin;
 client: Client;

 constructor(plugin: CustomRolesPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 reconcileKey = (guildId: string): string => `${reconcilePrefix}${guildId}`;

 rowsFor = async (guildId: string): Promise<RoleReward[]> =>
  this.client.db.client.roleReward.findMany({ where: { guild: guildId } });

 private lockedRewards = async (
  guildId: string,
  rewardIds: string[],
 ): Promise<Map<string, string>> => {
  if (!rewardIds.length) return new Map();

  const gates = await this.client.db.client.economyRoleReward.findMany({
   where: {
    guild: guildId,
    active: true,
    buyPrice: { gt: 0 },
    customRoleReward: { in: rewardIds },
   },
  });

  return new Map(
   gates.flatMap((gate) => (gate.customRoleReward ? [[gate.customRoleReward, gate.id]] : [])),
  );
 };

 private purchasedIds = async (
  guildId: string,
  userId: string,
  itemIds: string[],
 ): Promise<string[]> => {
  if (!itemIds.length) return [];

  const rows = await this.client.db.client.economyPurchase.findMany({
   where: { guild: guildId, user: userId, item: { in: itemIds } },
  });

  return rows.map((row) => row.item);
 };

 private grandfather = async (
  guildId: string,
  userId: string,
  itemIds: string[],
 ): Promise<string[]> => {
  const held = await this.client.db.client.customRole.findUnique({
   where: { guild_user: { guild: guildId, user: userId } },
  });
  if (!held) return [];

  await this.client.db.client.economyPurchase.createMany({
   data: itemIds.map((item) => ({
    id: mintId(),
    guild: guildId,
    user: userId,
    item,
    price: 0,
   })),
   skipDuplicates: true,
  });

  return itemIds;
 };

 resolveApplying = async (
  guildId: string,
  roleIds: string[],
  userId: string,
  preloaded?: RoleReward[],
 ): Promise<RoleReward[]> => {
  const rows = preloaded ?? (await this.rowsFor(guildId));

  const locks = await this.lockedRewards(
   guildId,
   rows.map((row) => row.id),
  );

  const granted = applyingRows(
   rows.filter((row) => !locks.has(row.id)),
   roleIds,
   userId,
  );
  if (!locks.size) return granted;

  const buyable = rows.filter(
   (row) =>
    locks.has(row.id) &&
    passesGates(row, roleIds, userId) &&
    (!row.roles.length || row.roles.some((id) => roleIds.includes(id))),
  );
  if (!buyable.length) return granted;

  const items = [...new Set(buyable.map((row) => locks.get(row.id)!))];
  const owned = await this.purchasedIds(guildId, userId, items);

  const missing = items.filter((item) => !owned.includes(item));
  const inherited = missing.length ? await this.grandfather(guildId, userId, missing) : [];
  const settled = new Set([...owned, ...inherited]);

  return [...granted, ...buyable.filter((row) => settled.has(locks.get(row.id)!))];
 };

 capabilitiesFor = async (
  guildId: string,
  roleIds: string[],
  userId: string,
 ): Promise<RewardCapabilities> =>
  mergeCapabilities(await this.resolveApplying(guildId, roleIds, userId));

 anchorFor = async (guildId: string, applying: RoleReward[]): Promise<string | null> => {
  const index = roleIndexFrom(await this.client.cache.roles.getAll(guildId));

  return selectAnchorRole(applying, (id) => index.get(id)?.position ?? NO_ROLE_POSITION);
 };

 storedDigest = async (guildId: string, userId: string): Promise<string[] | null> => {
  const row = await this.client.db.client.roleRewardEligibility.findUnique({
   where: { guild_user: { guild: guildId, user: userId } },
  });

  return row?.rewards ?? null;
 };

 private writeDigest = async (
  guildId: string,
  userId: string,
  rewards: string[],
 ): Promise<void> => {
  await this.client.db.client.roleRewardEligibility.upsert({
   where: { guild_user: { guild: guildId, user: userId } },
   create: { guild: guildId, user: userId, rewards },
   update: { rewards },
  });
 };

 private digestFor = async (
  guildId: string,
  userId: string,
  roleIds: string[],
  rows: RoleReward[],
 ): Promise<{ applying: RoleReward[]; plan: DigestPlan }> => {
  const applying = await this.resolveApplying(guildId, roleIds, userId, rows);
  const plan = planDigest(applying, await this.storedDigest(guildId, userId));

  if (plan.write) await this.writeDigest(guildId, userId, plan.rewards);

  return { applying, plan };
 };

 onMemberUpdate = async (guildId: string, userId: string, roleIds: string[]): Promise<void> => {
  const rows = await this.rowsFor(guildId);
  if (!rows.length) return;

  const { applying, plan } = await this.digestFor(guildId, userId, roleIds, rows);
  if (revokeFor(plan.lost, rows, applying)) {
   await this.plugin.roles.revoke(guildId, userId, CustomRolesReason.PrivilegeLost);
  }

  if (plan.action !== DigestAction.Changed || !plan.gained.length) return;

  const gained = rows.filter((row) => plan.gained.includes(row.id));
  await this.announce(guildId, userId, gained);
 };

 reconcileMember = async (
  guildId: string,
  userId: string,
  roleIds: string[],
  rows: RoleReward[],
 ): Promise<void> => {
  if (!rows.length) return;

  const { applying, plan } = await this.digestFor(guildId, userId, roleIds, rows);

  if (revokeFor(plan.lost, rows, applying)) {
   await this.plugin.roles.revoke(guildId, userId, CustomRolesReason.PrivilegeLost);
   return;
  }

  const capabilities = mergeCapabilities(applying);
  if (!capabilities.customRole) return;

  await this.plugin.roles.enforceShareCap(guildId, userId, capabilities.maxShare);
 };

 pruneRole = async (guildId: string, roleId: string): Promise<boolean> => {
  const affected = (await this.rowsFor(guildId)).filter(
   (row) =>
    row.roles.includes(roleId) || row.denyRoles.includes(roleId) || row.positionRole === roleId,
  );

  if (!affected.length) return false;

  await Promise.all(
   affected.map((row) =>
    this.client.db.client.roleReward.updateMany({
     where: { id: row.id, guild: guildId },
     data: {
      roles: row.roles.filter((id) => id !== roleId),
      denyRoles: row.denyRoles.filter((id) => id !== roleId),
      positionRole: row.positionRole === roleId ? null : row.positionRole,
     },
    }),
   ),
  );

  return true;
 };

 private announce = async (guildId: string, userId: string, rows: RoleReward[]): Promise<void> => {
  const destinations = new Map<string | null, RoleReward[]>();
  rows.forEach((row) =>
   destinations.set(row.notifyChannel, [...(destinations.get(row.notifyChannel) ?? []), row]),
  );

  await Promise.all(
   [...destinations].map(async ([channelId, group]) =>
    this.deliver(guildId, userId, channelId, await this.notification(guildId, group)).catch(
     (error: Error) => this.plugin.nonFatalError(error, 'customRoles.announce'),
    ),
   ),
  );
 };

 private notifyComponents = (
  guildId: string,
  t: CustomRolesTranslator,
 ): APIMessageTopLevelComponent[] => [
  new ActionRowBuilder<ButtonBuilder>()
   .addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.plugin.getRoute(CustomRolesRoute.RewardNotify, guildId))
     .setLabel(t.customRole.createButton()),
   )
   .toJSON(),
 ];

 private notification = async (
  guildId: string,
  rows: RoleReward[],
 ): Promise<{ content: string; components: APIMessageTopLevelComponent[] | null }> => {
  const t = await this.plugin.t(guildId);
  const guild = await this.client.cache.guilds.get(guildId);
  const mention = await commandMentions.call(await this.plugin.getAPI(guildId));

  const lines = [t.rewards.desc({ server: guild?.name ?? guildId })];
  const perk = rows.some((row) => row.customRole);

  if (perk) lines.push(t.rewards.customRole({ command: mention('custom-role create') }));

  return {
   content: lines.join('\n'),
   components: perk ? this.notifyComponents(guildId, t) : null,
  };
 };

 private deliver = async (
  guildId: string,
  userId: string,
  channelId: string | null,
  message: { content: string; components: APIMessageTopLevelComponent[] | null },
 ): Promise<void> => {
  const payload = new MessagePayload(this.client, { origin, reason: notifyReason }).setComponents(
   message.components,
  );

  if (channelId) {
   await payload
    .setContent(`<@${userId}>\n${message.content}`)
    .setSendTo([{ channel: channelId, guildId }])
    .send();

   return;
  }

  const api = await this.plugin.getAPI(guildId);
  const dm = await api.users.createDM(userId, { origin, reason: notifyReason });
  if (dm instanceof RequestHandlerError) {
   this.plugin.nonFatalError(dm, 'customRoles.announce.dm');
   return;
  }

  await payload
   .setContent(message.content)
   .setSendTo([{ channel: dm.id, guildId: '@me' }])
   .send();
 };

 enqueueReconcile = async (guildId: string): Promise<void> => {
  await arm.call(this.client, this.reconcileKey(guildId), '', 1);
 };

 private cursorFor = async (key: string): Promise<string> => {
  const db = this.client.cache.scheduleDb;
  if (!db) return '';

  return (await db.get(dataKey(key))) ?? '';
 };

 runChunk = async (guildId: string): Promise<void> => {
  const key = this.reconcileKey(guildId);
  const cursor = await this.cursorFor(key);

  const rows = await this.rowsFor(guildId);
  const members = await this.client.cache.members.getAll(guildId);
  const page = members
   .filter((member) => member.user_id > cursor)
   .sort((a, b) => (a.user_id < b.user_id ? -1 : 1))
   .slice(0, reconcileChunkSize);

  for (const member of page) {
   await this.reconcileMember(guildId, member.user_id, member.roles, rows);
  }

  if (page.length < reconcileChunkSize) {
   await disarm.call(this.client, key);
   return;
  }

  await arm.call(this.client, key, page[page.length - 1].user_id, reconcileChunkDelaySeconds);
 };

 onScheduleExpired = async (rawKey: string): Promise<void> => {
  if (!this.plugin.isEnabled()) return;

  const key = stripMarkerPrefix(rawKey);
  if (!key.startsWith(reconcilePrefix)) return;

  const guildId = key.slice(reconcilePrefix.length);
  if (!guildId) return;

  await this.runChunk(guildId).catch((error: Error) =>
   this.plugin.nonFatalError(error, 'customRoles.reconcile.chunk'),
  );
 };

 reconcileEligibility = async (): Promise<void> => {
  if (!this.client.cache.scheduleDb) return;

  for (const raw of await scanDataKeys.call(this.client, `${dataKey(reconcilePrefix)}*`)) {
   const key = stripDataPrefix(raw);
   if (await isArmed.call(this.client, key)) continue;

   const guildId = key.slice(reconcilePrefix.length);
   if (!guildId) continue;

   await arm.call(this.client, key, await this.cursorFor(key), 1);
  }
 };
}
