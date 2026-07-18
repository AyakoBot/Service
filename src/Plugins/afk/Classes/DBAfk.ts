import type { AfkState as AfkStateRow } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type { WhereUnique } from '../../../Types/prisma.js';
import type AFKPlugin from '../Plugin.js';

const defaultMaxLetters = 250;

export default abstract class DBAfk {
 plugin: AFKPlugin;
 userId: string;
 guild: string;
 protected client: Client;
 private where: WhereUnique<'afkState'>;

 constructor(plugin: AFKPlugin, userId: string, guildId: string) {
  this.client = plugin.client;
  this.where = { userId_guildId: { userId, guildId } };
  this.plugin = plugin;
  this.userId = userId;
  this.guild = guildId;
 }

 get(): Promise<AfkStateRow | null> {
  return this.client.db.client.afkState.findUnique({ where: this.where });
 }

 async set(
  _cmd: APIChatInputApplicationCommandInteraction | RMessage,
  reason: string | null | undefined,
 ): Promise<void> {
  await this.client.db.client.afkState.upsert({
   where: this.where,
   create: { userId: this.userId, guildId: this.guild, reason, since: Date.now() },
   update: { reason, since: Date.now() },
  });
 }

 async remove(_msg: RMessage): Promise<void> {
  await this.client.db.client.afkState.delete({ where: this.where });
 }

 async clampReason(reason: string | null | undefined) {
  if (!reason) return reason;

  const setting = await this.client.db.client.afkSetting.findUnique({
   where: { guildId: this.guild },
  });
  return reason.slice(0, setting?.maxLetters ?? defaultMaxLetters);
 }
}
