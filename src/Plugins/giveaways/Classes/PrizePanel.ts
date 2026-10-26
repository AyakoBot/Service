import { RequestHandlerError } from '@ayako/api';
import type { GiveawayTemplate } from '@ayako/database';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { maxPrizeLength, origin, panelLockMs } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { giveawayDefaults } from '../Util/giveawayDefaults.js';
import { buildPanelModal, readPanelModal } from '../Util/prizeModal.js';
import { buildPanel, panelArgs, readPanelPrizes, type PanelState } from '../Util/prizePanel.js';
import requireManager from '../Util/requireManager.js';
import { templatePlan } from '../Util/templateData.js';

import { GiveawayErrors } from './DBGiveaway.js';
import { GiveawaysRoute, PanelOrigin } from './Routes.js';

type PanelTarget = Pick<PanelState, 'templateId' | 'channelId' | 'origin'>;

const lockKey = (messageId: string) => `giveaways:panel:${messageId}`;

export const parsePanelArgs = (args: string[]): PanelTarget | null => {
 const [templateId, channelId, from] = args;
 const known = Object.values(PanelOrigin).find((value) => value === from);

 return templateId && channelId && known ? { templateId, channelId, origin: known } : null;
};

export default class PrizePanel {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 open = async (
  cmd: APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction,
  template: GiveawayTemplate,
  channelId: string,
  from: PanelOrigin,
 ) => {
  requireManager(cmd);

  const payload = await this.payload(
   template,
   { templateId: template.id, channelId, origin: from },
   [],
  );
  payload.setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral).reply(cmd);
 };

 due = async (cmd: APIMessageComponentInteraction, templateId: string) => {
  requireManager(cmd);

  const template = await this.plugin.templates.byId(this.guildOf(cmd), templateId);
  if (!template.channel) throw new Error(GiveawayErrors.templateNoChannel);

  await this.open(cmd, template, template.channel, PanelOrigin.Due);
 };

 edit = async (cmd: APIMessageComponentInteraction, target: PanelTarget) => {
  requireManager(cmd);

  const t = await this.plugin.t(this.guildOf(cmd));
  const modal = buildPanelModal(
   t,
   this.plugin.getRoute(GiveawaysRoute.PanelSave, ...panelArgs(target)),
   readPanelPrizes(cmd.message.components),
  );

  const api = await this.plugin.api(this.guildOf(cmd));
  const opened = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
   origin,
   reason: 'Opening giveaway personal prizes',
  });
  if (opened instanceof RequestHandlerError) this.plugin.nonFatalError(opened, 'giveawayPanel');
 };

 save = async (cmd: APIModalSubmitInteraction, target: PanelTarget) => {
  requireManager(cmd);

  const prizes = readPanelModal(cmd.data.components);
  if (prizes.some((value) => value.length > maxPrizeLength)) {
   throw new Error(GiveawayErrors.prizeTooLong);
  }

  const template = await this.plugin.templates.byId(this.guildOf(cmd), target.templateId);
  const payload = await this.payload(template, target, prizes);
  payload.setFlags(MessageFlags.IsComponentsV2).update(cmd);
 };

 start = async (cmd: APIMessageComponentInteraction, target: PanelTarget) => {
  requireManager(cmd);

  const guildId = this.guildOf(cmd);
  const prizes = readPanelPrizes(cmd.message.components);
  const template = await this.plugin.templates.byId(guildId, target.templateId);
  if (prizes.length < (await this.winnersOf(template))) throw new Error(GiveawayErrors.prizesShort);

  if (!(await this.lock(cmd, target))) throw new Error(GiveawayErrors.alreadyStarted);

  await this.plugin.launcher
   .startTemplate(
    template,
    target.channelId,
    cmd.member?.user.id ?? '',
    cmd.member?.user.username ?? '',
    prizes,
   )
   .catch(async (error: Error) => {
    await this.unlock(cmd, target);
    throw error;
   });

  const t = await this.plugin.t(guildId);
  new MessagePayload(this.client, { origin, reason: 'Giveaway personal prizes' })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    new ContainerBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t.create.sent({ channel: `<#${target.channelId}>` })),
     )
     .toJSON(),
   ])
   .update(cmd);
 };

 private payload = async (template: GiveawayTemplate, target: PanelTarget, prizes: string[]) => {
  const t = await this.plugin.t(template.guild);
  const api = await this.plugin.api(template.guild);

  return new MessagePayload(this.client, {
   origin,
   reason: 'Giveaway personal prizes',
  }).setComponents(
   buildPanel.call(this.plugin, t, this.client.emojis.for(api), {
    ...target,
    name: template.name ?? '',
    winners: await this.winnersOf(template),
    prizes,
   }),
  );
 };

 private winnersOf = async (template: GiveawayTemplate) => {
  const defaults = await giveawayDefaults.call(this.plugin, template.guild);
  return Number(templatePlan(template, defaults).data.winnerCount);
 };

 private lock = async (cmd: APIMessageComponentInteraction, target: PanelTarget) =>
  target.origin === PanelOrigin.Due
   ? this.plugin.templates.claimDue(target.templateId)
   : (await this.client.cache.cacheDb.set(
      lockKey(cmd.message.id),
      '1',
      'PX',
      panelLockMs,
      'NX',
     )) === 'OK';

 private unlock = async (cmd: APIMessageComponentInteraction, target: PanelTarget) => {
  if (target.origin === PanelOrigin.Due) {
   await this.plugin.templates.markDue(target.templateId);
   return;
  }

  await this.client.cache.cacheDb.del(lockKey(cmd.message.id));
 };

 private guildOf = (cmd: { guild_id?: string }) => cmd.guild_id ?? '';
}
