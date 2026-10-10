import { RequestHandlerError } from '@ayako/api';
import type { BumpReminderSetting } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10';

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
import type BumpRemindersPlugin from '../Plugin.js';
import { bumpKey, bumpKeyPrefix, parseBumpKey } from '../Util/bumpKey.js';

import { bumpCommand, isConfigured, providerName } from './Providers.js';
import { BumpRemindersRoute, origin } from './Routes.js';

type BumpState = { channel: string; message?: string };

export default class Bumps {
 plugin: BumpRemindersPlugin;
 client: Client;

 constructor(plugin: BumpRemindersPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 byId = (settingsId: string, guildId: string): Promise<BumpReminderSetting | null> =>
  this.client.db.client.bumpReminderSetting.findFirst({
   where: { id: settingsId, guild: guildId },
  });

 activeForBot = (guildId: string, botId: string): Promise<BumpReminderSetting[]> =>
  this.client.db.client.bumpReminderSetting.findMany({
   where: { guild: guildId, active: true, botId },
  });

 bumped = async (
  setting: BumpReminderSetting,
  channelId: string,
  reminderMessageId?: string,
 ) => {
  const state = await this.state(setting.id, setting.guild);

  const stale = new Map<string, string>();
  if (state?.message) stale.set(state.message, state.channel);
  if (reminderMessageId) stale.set(reminderMessageId, channelId);
  for (const [message, channel] of stale) {
   await this.deleteReminder(setting.guild, channel, message);
  }

  const cooldown = Number(setting.cooldownSeconds);
  if (cooldown <= 0) {
   await this.disarm(setting.id, setting.guild);
   return;
  }

  await arm.call(
   this.client,
   bumpKey(setting.id, setting.guild),
   JSON.stringify({ channel: setting.channel ?? channelId } satisfies BumpState),
   cooldown,
  );
 };

 disarm = async (settingsId: string, guildId: string) => {
  await disarm.call(this.client, bumpKey(settingsId, guildId));
 };

 onScheduleExpired = async (rawKey: string) => {
  if (!this.plugin.isEnabled()) return;

  const parsed = parseBumpKey(stripMarkerPrefix(rawKey));
  if (!parsed) return;

  await this.fire(parsed.settingsId, parsed.guildId).catch((e: Error) =>
   this.plugin.nonFatalError(e, 'scheduled bump reminder'),
  );
 };

 fire = async (settingsId: string, guildId: string) => {
  const state = await this.state(settingsId, guildId);
  const setting = await this.byId(settingsId, guildId);
  const channel = setting?.channel ?? state?.channel;

  if (!setting || !setting.active || !isConfigured(setting) || !channel) {
   await this.disarm(settingsId, guildId);
   return;
  }

  if (state?.message) await this.deleteReminder(guildId, state.channel, state.message);

  const t = await this.plugin.t(guildId);
  const command = bumpCommand(setting);

  const pings = [
   setting.roles.map((r) => `<@&${r}>`).join(' '),
   setting.users.map((u) => `<@${u}>`).join(' '),
  ].filter((p) => p.length);

  const container = new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `### ${t.title({ provider: providerName(setting, t.unnamedProvider()) })}\n${
      command ? t.reminderText({ command }) : t.reminderTextNoCommand()
     }`,
    ),
   )
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.plugin.getRoute(BumpRemindersRoute.Bumped, setting.id))
      .setLabel(t.bumpedButton()),
    ),
   );

  const payload = new MessagePayload(this.client, { origin, reason: 'Bump reminder' })
   .setFlags(MessageFlags.IsComponentsV2)
   .setAllowedMentionsRoles(setting.roles)
   .setAllowedMentionsUsers(setting.users)
   .setComponents([
    ...(pings.length ? [new TextDisplayBuilder().setContent(pings.join('\n')).toJSON()] : []),
    container.toJSON(),
   ]);

  const api = await this.plugin.getAPI(guildId);
  const message = await api.channels.createMessage(channel, payload.getAPIPayload(), {
   origin,
   reason: 'Bump reminder',
  });
  if (message instanceof RequestHandlerError) {
   this.plugin.nonFatalError(message, 'send bump reminder');
   await this.disarm(settingsId, guildId);
   return;
  }

  if (!setting.repeatEnabled || Number(setting.repeatReminder) <= 0) {
   await this.disarm(settingsId, guildId);
   return;
  }

  await arm.call(
   this.client,
   bumpKey(settingsId, guildId),
   JSON.stringify({ channel, message: message.id } satisfies BumpState),
   Number(setting.repeatReminder),
  );
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const dataKeys = await scanDataKeys.call(this.client, `${dataKey(bumpKeyPrefix)}*`);
  for (const raw of dataKeys) {
   const key = stripDataPrefix(raw);
   if (await isArmed.call(this.client, key)) continue;

   const parsed = parseBumpKey(key);
   if (!parsed) continue;

   await this.fire(parsed.settingsId, parsed.guildId).catch((e: Error) =>
    this.plugin.nonFatalError(e, 'reconcile bump reminder'),
   );
  }
 };

 private state = async (settingsId: string, guildId: string): Promise<BumpState | null> => {
  const db = this.client.cache.scheduleDb;
  if (!db) return null;

  const raw = await db.get(dataKey(bumpKey(settingsId, guildId)));
  if (!raw) return null;

  try {
   return JSON.parse(raw) as BumpState;
  } catch {
   return null;
  }
 };

 private deleteReminder = async (guildId: string, channelId: string, messageId: string) => {
  const api = await this.plugin.getAPI(guildId);
  const res = await api.channels.deleteMessage(channelId, messageId, {
   origin,
   reason: 'Old bump reminder',
  });
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'delete old reminder');
 };
}
