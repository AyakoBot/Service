import { RequestHandlerError, type API } from '@ayako/api';
import { getGuildPerms } from '@ayako/utility';
import { PermissionFlagsBits } from '@discordjs/core';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import {
 arm,
 dataKey,
 disarm,
 isArmed,
 scanDataKeys,
 stripDataPrefix,
 stripMarkerPrefix,
} from '../../../Util/schedule.js';
import type VerificationPlugin from '../Plugin.js';
import { kickKey, kickKeyPrefix, parseKickKey } from '../Util/kickKey.js';

import { origin } from './Routes.js';
import Verification from './Verification.js';

export default class VerificationKicks {
 plugin: VerificationPlugin;
 client: Client;

 constructor(plugin: VerificationPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 arm = async (guildId: string, userId: string, seconds: number) => {
  await arm.call(this.client, kickKey(guildId, userId), '1', seconds);
 };

 disarm = async (guildId: string, userId: string) => {
  await disarm.call(this.client, kickKey(guildId, userId));
 };

 onScheduleExpired = async (rawKey: string) => {
  if (!this.plugin.isEnabled()) return;

  const parsed = parseKickKey(stripMarkerPrefix(rawKey));
  if (!parsed) return;

  await this.fire(parsed.guildId, parsed.userId).catch((e: Error) =>
   this.plugin.nonFatalError(e, 'scheduled kick'),
  );
 };

 fire = async (guildId: string, userId: string) => {
  await this.disarm(guildId, userId);

  const verification = await Verification.fetch(this.plugin, guildId);
  if (!verification) return;

  const { kick, verifiedRole } = verification.settings;
  if (!kick || !verifiedRole) return;
  if (!(await this.client.cache.roles.get(verifiedRole))) return;

  const api = await this.plugin.getAPI(guildId);
  const memberRoles = await this.memberRoles(guildId, userId, api);
  if (!memberRoles) return;
  if (memberRoles.includes(verifiedRole)) return;
  if (!(await this.canKick(guildId, userId, memberRoles, api))) return;

  const t = await this.plugin.t(guildId);
  const guild = await this.client.cache.guilds.get(guildId);

  const dm = await api.users.createDM(userId, { origin, reason: 'Verification kick notice' });
  if (!(dm instanceof RequestHandlerError)) {
   const notice = await api.channels.createDirectMessage(
    dm.id,
    new MessagePayload(this.client, { origin, reason: 'Verification kick notice' })
     .setContent(t.kickMsg({ guild: guild?.name ?? '' }))
     .getAPIPayload(),
    { origin, reason: 'Verification kick notice' },
   );
   if (notice instanceof RequestHandlerError) this.plugin.nonFatalError(notice, 'kick notice');
  }

  const removed = await api.guilds.removeMember(guildId, userId, {
   origin,
   reason: t.kickReason(),
  });
  if (removed instanceof RequestHandlerError) this.plugin.nonFatalError(removed, 'verification kick');
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const dataKeys = await scanDataKeys.call(this.client, `${dataKey(kickKeyPrefix)}*`);
  for (const raw of dataKeys) {
   const key = stripDataPrefix(raw);
   if (await isArmed.call(this.client, key)) continue;

   const parsed = parseKickKey(key);
   if (!parsed) continue;

   await this.fire(parsed.guildId, parsed.userId).catch((e: Error) =>
    this.plugin.nonFatalError(e, 'reconcile kick'),
   );
  }
 };

 private memberRoles = async (
  guildId: string,
  userId: string,
  api: API,
 ): Promise<string[] | null> => {
  const cached = await this.client.cache.members.get(guildId, userId);
  if (cached) return cached.roles;

  const fetched = await api.guilds.getMember(guildId, userId, {
   origin,
   reason: 'Verification kick',
  });
  return fetched instanceof RequestHandlerError ? null : fetched.roles;
 };

 private canKick = async (guildId: string, userId: string, memberRoles: string[], api: API) => {
  const guild = await this.client.cache.guilds.get(guildId);
  if (!guild || guild.owner_id === userId) return false;

  const perms = await getGuildPerms.call(this.client.cache, guildId, api.botId);
  const canKickMembers =
   (perms.response & PermissionFlagsBits.KickMembers) > 0n ||
   (perms.response & PermissionFlagsBits.Administrator) > 0n;
  if (!canKickMembers) return false;

  const me = await this.client.cache.members.get(guildId, api.botId);
  if (!me) return false;

  const roles = await this.client.cache.roles.getAll(guildId);
  const highest = (ids: string[]) =>
   roles.filter((r) => ids.includes(r.id)).reduce((acc, r) => Math.max(acc, r.position), 0);

  return highest(me.roles) > highest(memberRoles);
 };
}
