import { RequestHandlerError } from '@ayako/api';
import type { Giveaway as GiveawayRow } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 LabelBuilder,
 ModalBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import { appIdOf } from '../../../Util/appIdTokens.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { findModalValue } from '../../../Util/findModalValue.js';
import parseDuration from '../../../Util/parseDuration.js';
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { minDurationMs } from '../../reminders/Classes/DBReminder.js';
import type RemindersPlugin from '../../reminders/Plugin.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { giveawayLink } from '../Util/container.js';
import remindPrefill from '../Util/remindPrefill.js';

import { GiveawayErrors } from './DBGiveaway.js';
import Giveaway from './Giveaway.js';
import { GiveawaysRoute } from './Routes.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

enum RemindField {
 Duration = 'duration',
 Reason = 'reason',
}

const durationLimit = 50;
const reasonLimit = 2000;

export default class GiveawayReminders {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 refuse = async (cmd: APIMessageComponentInteraction, giveaway: GiveawayRow, content: string) => {
  const t = await this.plugin.t(giveaway.guild);
  const payload = new MessagePayload(this.client, { origin, reason: 'Giveaway entry refused' })
   .setContent(content)
   .setFlags(MessageFlags.Ephemeral);

  if (this.reminders() && remindPrefill(giveaway.endTime, Date.now())) {
   payload.setComponents([this.button(t, giveaway)]);
  }

  await payload.reply(cmd);
 };

 open = async (cmd: APIMessageComponentInteraction, messageId: string) => {
  const giveaway = await this.running(cmd.guild_id, messageId);
  const duration = remindPrefill(giveaway.endTime, Date.now());
  if (!duration || !this.reminders()) throw new Error(GiveawayErrors.remindUnavailable);

  const t = await this.plugin.t(giveaway.guild);
  const api = await this.plugin.api(giveaway.guild);
  const opened = await api.interactions.createModal(
   cmd.id,
   cmd.token,
   this.modal(t, giveaway, duration).toJSON(),
   { origin, reason: 'Opening giveaway reminder' },
  );
  if (opened instanceof RequestHandlerError) this.plugin.nonFatalError(opened, 'giveawayRemind');
 };

 submit = async (cmd: APIModalSubmitInteraction, messageId: string) => {
  const reminders = this.reminders();
  const userId = cmd.member?.user.id;
  if (!reminders || !userId) throw new Error(GiveawayErrors.remindUnavailable);

  const giveaway = await this.running(cmd.guild_id, messageId);
  const raw = findModalValue(cmd.data.components, RemindField.Duration) ?? '';
  const durationMs = parseDuration(raw) ?? 0;
  if (durationMs < minDurationMs) throw new Error(GiveawayErrors.remindTooShort);

  const row = await reminders.engine.schedule({
   userId,
   channelId: giveaway.channel,
   reason: findModalValue(cmd.data.components, RemindField.Reason) ?? '',
   durationMs,
  });

  const t = await this.plugin.t(giveaway.guild);
  const time = `<t:${Math.floor(Number(row.endTime) / 1000)}:R>`;
  ephemeralNote.call(
   this.plugin,
   cmd,
   `${t.remind.set({ time })}\n${this.deliveryNote(t, cmd.application_id)}`,
  );
 };

 private running = (guildId: string | undefined, messageId: string) =>
  new Giveaway(this.plugin, messageId, guildId ?? '').getRunning(GiveawayErrors.notFound);

 private reminders = () => {
  const reminders = this.client.plugins.find(
   (plugin) => plugin.settingName === PluginName.Reminders,
  ) as RemindersPlugin | undefined;

  return reminders?.isEnabled() ? reminders : null;
 };

 private button = (t: Translator, giveaway: GiveawayRow) =>
  new ActionRowBuilder<ButtonBuilder>()
   .addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.plugin.getRoute(GiveawaysRoute.Remind, giveaway.message))
     .setLabel(t.remind.button()),
   )
   .toJSON();

 private modal = (t: Translator, giveaway: GiveawayRow, duration: string) =>
  new ModalBuilder()
   .setCustomId(this.plugin.getRoute(GiveawaysRoute.RemindSubmit, giveaway.message))
   .setTitle(t.remind.title())
   .addLabelComponents(
    new LabelBuilder()
     .setLabel(t.remind.duration())
     .setDescription(t.remind.durationHint())
     .setTextInputComponent(
      new TextInputBuilder()
       .setCustomId(RemindField.Duration)
       .setStyle(TextInputStyle.Short)
       .setRequired(true)
       .setMaxLength(durationLimit)
       .setValue(duration),
     ),
    new LabelBuilder().setLabel(t.remind.reason()).setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(RemindField.Reason)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(reasonLimit)
      .setValue(t.remind.reasonValue({ link: giveawayLink(giveaway) })),
    ),
   );

 private deliveryNote = (t: Translator, applicationId: string) => {
  const remindersApp = appIdOf(process.env[PluginBotKey.Reminders] ?? '');
  if (!remindersApp || applicationId === this.client.getBaseAPI().botId) return t.remind.openDms();

  return t.remind.addApp({ link: constants.standard.userInstallUrl(remindersApp) });
 };
}
