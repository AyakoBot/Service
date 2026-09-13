import type { EconomySetting } from '@ayako/database';
import type { APIEmbed } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { Colors } from '../../../Types/index.js';
import { codeId } from '../../../Util/fmt.js';
import type EconomyPlugin from '../Plugin.js';

import type { LedgerReason } from './Enums.js';

export interface LedgerEntry {
 guildId: string;
 userId: string;
 amount: number;
 reason: LedgerReason;
 executorId?: string;
 note?: string;
}

const logMergeTimeoutMs = 2000;

export default class EconomyLogger {
 plugin: EconomyPlugin;
 client: Client;

 constructor(plugin: EconomyPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 record = async (entry: LedgerEntry): Promise<void> => {
  const settings = await this.plugin.bank.settings(entry.guildId);
  if (!settings.logChannels.length) return;

  await this.send(settings, await this.embedOf(settings, entry));
 };

 private embedOf = async (settings: EconomySetting, entry: LedgerEntry): Promise<APIEmbed> => {
  const t = await this.plugin.t(entry.guildId);
  const symbol = this.plugin.symbolOf(settings);
  const signed = entry.amount >= 0 ? `+${entry.amount}` : String(entry.amount);

  const fields = [
   { name: t.base.t.User(), value: `<@${entry.userId}> ${codeId(entry.userId)}`, inline: true },
   { name: t.log.amount(), value: `${signed} ${symbol}`, inline: true },
   { name: t.log.reason(), value: t.reasons[entry.reason](), inline: true },
  ];

  if (entry.executorId) {
   fields.push({ name: t.log.executor(), value: `<@${entry.executorId}>`, inline: true });
  }
  if (entry.note) fields.push({ name: t.base.t.Reason(), value: entry.note, inline: false });

  return {
   title: t.log.title(),
   color: entry.amount >= 0 ? Colors.Success : Colors.Danger,
   fields,
   timestamp: new Date().toISOString(),
  };
 };

 private send = async (settings: EconomySetting, embed: APIEmbed): Promise<void> => {
  await new MessagePayload(this.client, { origin: this.plugin.name, reason: 'Economy log' })
   .setEmbeds([embed])
   .setAllowedMentionsRoles([])
   .setAllowedMentionsUsers([])
   .setMergeTimeout(logMergeTimeoutMs)
   .setSendTo([{ channel: settings.logChannels, guildId: settings.guild }])
   .send();
 };
}
