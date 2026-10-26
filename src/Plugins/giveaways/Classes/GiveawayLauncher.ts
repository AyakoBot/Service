import { RequestHandlerError } from '@ayako/api';
import {
 GiveawayEnforcement,
 Prisma,
 type Giveaway as GiveawayRow,
 type GiveawayTemplate,
} from '@ayako/database';
import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import type { CreateData } from '../../../Types/prisma.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { getChannelOption, getStringOption } from '../../../Util/interactionOptions.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { snapshotBonusRoles } from '../Util/bonusEntries.js';
import { giveawayDefaults } from '../Util/giveawayDefaults.js';
import { readOptions, toRowData } from '../Util/giveawayOptions.js';
import renderGiveaway from '../Util/render.js';
import { needsActivity, type ActivityColumns } from '../Util/requirements.js';
import { resolveSurface, resolveTemplateDesign } from '../Util/resolveSurface.js';
import { templateOverrides, templatePlan, withDefaults } from '../Util/templateData.js';

import { GiveawayErrors } from './DBGiveaway.js';
import Giveaway from './Giveaway.js';
import { GiveawayOption, PanelOrigin } from './Routes.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;

export interface LaunchInput {
 guildId: string;
 channelId: string;
 actor: string;
 data: Record<string, unknown>;
 bonusRoles: string[];
 bonusExtra: number;
 prizes: string[];
}

const noActivity: ActivityColumns = { minMessages: null, minMessagesSince: null, minVoiceSeconds: null };

const draftRow = (guild: string, channel: string): GiveawayRow => ({
 guild,
 channel,
 message: '',
 description: '',
 prize: null,
 host: '',
 winnerCount: new Prisma.Decimal(1),
 endTime: new Date(),
 participants: [],
 winners: [],
 unclaimedWinners: [],
 forfeited: [],
 ended: false,
 cancelled: false,
 collectSeconds: null,
 failReroll: false,
 claimUntil: null,
 claimingDone: false,
 announceMessage: null,
 template: null,
 requiredRoles: [],
 excludedRoles: [],
 minAccountSeconds: null,
 minTenureSeconds: null,
 minMessages: null,
 minMessagesSince: null,
 minVoiceSeconds: null,
 enforcement: GiveawayEnforcement.onEnd,
 personalPrizes: false,
 currency: null,
 winnerRoles: [],
 rewarded: [],
 design: null,
 banner: null,
 thumbnail: null,
 accentColor: null,
});

export default class GiveawayLauncher {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 quick = async (cmd: APIChatInputApplicationCommandInteraction, sub: Sub) => {
  const guildId = cmd.guild_id;
  const userId = cmd.member?.user.id;
  if (!guildId || !userId) return;

  const options = readOptions(sub);
  if (!options.description?.trim().length) throw new Error(GiveawayErrors.missingDescription);

  const defaults = await giveawayDefaults.call(this.plugin, guildId);
  const channelId = options.channel ?? cmd.channel.id;

  await this.launch({
   guildId,
   channelId,
   actor: cmd.member?.user.username ?? '',
   data: { ...withDefaults(toRowData(options), defaults), host: options.host ?? userId },
   bonusRoles: [],
   bonusExtra: 1,
   prizes: [],
  });
  await this.sent(cmd, guildId, channelId);
 };

 fromTemplate = async (cmd: APIChatInputApplicationCommandInteraction, sub: Sub) => {
  const guildId = cmd.guild_id;
  const userId = cmd.member?.user.id;
  if (!guildId || !userId) return;

  const template = await this.plugin.templates.byName(
   guildId,
   getStringOption(sub, GiveawayOption.Template) ?? '',
  );
  const channelId = getChannelOption(sub, GiveawayOption.Channel) ?? template.channel ?? cmd.channel.id;

  const overrides = templateOverrides(readOptions(sub));

  if (template.personalPrizes) {
   if (Object.keys(overrides).length) throw new Error(GiveawayErrors.overridesPersonalPrizes);
   await this.plugin.panel.open(cmd, template, channelId, PanelOrigin.Command);
   return;
  }

  await this.startTemplate(
   { ...template, ...overrides },
   channelId,
   userId,
   cmd.member?.user.username ?? '',
   [],
  );
  await this.sent(cmd, guildId, channelId);
 };

 startTemplate = async (
  template: GiveawayTemplate,
  channelId: string,
  host: string,
  actor: string,
  prizes: string[],
 ): Promise<GiveawayRow> => {
  const defaults = await giveawayDefaults.call(this.plugin, template.guild);
  const plan = templatePlan(template, defaults);
  const design = await resolveTemplateDesign.call(this.plugin, template.guild, template);

  return this.launch({
   guildId: template.guild,
   channelId,
   actor,
   data: { ...plan.data, host: template.host ?? host, ...(design ? { design } : {}) },
   bonusRoles: plan.bonusRoles,
   bonusExtra: plan.bonusExtra,
   prizes,
  });
 };

 launch = async (input: LaunchInput): Promise<GiveawayRow> => {
  const { guildId, channelId } = input;
  await this.requireTracking(guildId, input.data);

  const t = await this.plugin.t(guildId);
  const reason = t.giveaway.reason({ user: input.actor });
  const surface = await resolveSurface.call(this.plugin, {
   ...draftRow(guildId, channelId),
   ...input.data,
  });

  const payload = new MessagePayload(this.client, { origin, reason })
   .setFlags(surface.flags)
   .setContent(surface.content)
   .setEmbeds(surface.embeds)
   .setComponents(surface.components);

  const api = await this.plugin.api(guildId);
  const message = await api.channels.createMessage(channelId, payload.getAPIPayload(), {
   origin,
   reason,
  });
  if (message instanceof RequestHandlerError) throw new Error(GiveawayErrors.missingPerms);

  const giveaway = await new Giveaway(this.plugin, message.id, guildId)
   .register({
    ...input.data,
    guild: guildId,
    channel: channelId,
    message: message.id,
   } as CreateData<'giveaway'>)
   .catch(async (error: Error) => {
    await this.rollback(guildId, channelId, message.id);
    throw error;
   });

  await snapshotBonusRoles.call(this.plugin, giveaway.message, input.bonusRoles, input.bonusExtra);
  if (input.prizes.length) await this.plugin.prizes.replace(giveaway.message, input.prizes);
  if (input.bonusRoles.length) await renderGiveaway.call(this.plugin, giveaway);

  await this.plugin.engine.armEnd(giveaway);
  await this.plugin.logs.created(giveaway);
  return giveaway;
 };

 private sent = async (
  cmd: APIChatInputApplicationCommandInteraction,
  guildId: string,
  channelId: string,
 ) => {
  const t = await this.plugin.t(guildId);
  ephemeralNote.call(this.plugin, cmd, t.create.sent({ channel: `<#${channelId}>` }));
 };

 private requireTracking = async (guildId: string, data: Record<string, unknown>) => {
  if (!needsActivity({ ...noActivity, ...data } as ActivityColumns)) return;
  if (!(await this.plugin.activity.tracks(guildId))) throw new Error(GiveawayErrors.activityOff);
 };

 private rollback = async (guildId: string, channelId: string, messageId: string) => {
  const api = await this.plugin.api(guildId);
  const deleted = await api.channels.deleteMessage(channelId, messageId, {
   origin,
   reason: 'Rolling back a failed giveaway creation',
  });

  if (deleted instanceof RequestHandlerError) {
   this.plugin.nonFatalError(deleted, 'giveawayCreateRollback');
  }
 };
}
