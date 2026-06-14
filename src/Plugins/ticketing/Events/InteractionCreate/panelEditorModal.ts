import type { TicketSetting } from '@ayako/database';
import {
 ChannelSelectMenuBuilder,
 LabelBuilder,
 ModalBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 ChannelType,
 ComponentType,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { TicketRoute } from '../../Classes/Routes.js';
import TicketPanel from '../../Classes/TicketPanel.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { findModalValue, findModalValues } from '../../Util/findModalValue.js';
import { renderHubPanel } from '../../Util/renderPanel.js';
import { systemDisplayLabel } from '../../Util/systemLabel.js';

import { buildPanelEditor, panelWarn, selectOptionLimit } from './panelEditor.js';

const kindOptions = (
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 kinds: TicketSetting[],
 selected: string[],
) =>
 kinds.slice(0, selectOptionLimit).map((kind) =>
  new StringSelectMenuOptionBuilder()
   .setLabel(systemDisplayLabel(t, kind).slice(0, 100))
   .setValue(String(kind.id))
   .setDefault(selected.includes(String(kind.id))),
 );

const guildKinds = async function (this: TicketPlugin, guildId: string): Promise<TicketSetting[]> {
 return this.client.db.client.ticketSetting.findMany({ where: { guild: guildId } });
};

export const panelAdd = async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const kinds = await guildKinds.call(this, cmd.guild_id);

 if (!kinds.length) {
  panelWarn.call(this, cmd, t.panel.errors.noKinds());
  return;
 }

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.PanelSave))
  .setTitle(t.panel.addTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.panel.fields.channel())
    .setChannelSelectMenuComponent(
     new ChannelSelectMenuBuilder()
      .setCustomId('channel')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
    ),
   new LabelBuilder()
    .setLabel(t.panel.fields.kinds())
    .setDescription(t.panel.fields.kindsHint())
    .setStringSelectMenuComponent(
     new StringSelectMenuBuilder()
      .setCustomId('kinds')
      .setMinValues(1)
      .setMaxValues(Math.min(kinds.length, selectOptionLimit))
      .addOptions(kindOptions(t, kinds, [])),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening panel add modal',
 });
};

export const panelEdit = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const panel = await TicketPanel.byId(this.client, args[0]);
 if (!panel || panel.guild !== cmd.guild_id) {
  panelWarn.call(this, cmd, t.panel.errors.notFound());
  return;
 }

 const kinds = await guildKinds.call(this, cmd.guild_id);
 if (!kinds.length) {
  panelWarn.call(this, cmd, t.panel.errors.noKinds());
  return;
 }

 const selected = panel.kinds.map((k) => String(k));

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.PanelSave, panel.id))
  .setTitle(t.panel.editTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.panel.fields.channel())
    .setChannelSelectMenuComponent(
     new ChannelSelectMenuBuilder()
      .setCustomId('channel')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1)
      .setDefaultChannels(panel.channel ? [panel.channel] : []),
    ),
   new LabelBuilder()
    .setLabel(t.panel.fields.kinds())
    .setDescription(t.panel.fields.kindsHint())
    .setStringSelectMenuComponent(
     new StringSelectMenuBuilder()
      .setCustomId('kinds')
      .setMinValues(1)
      .setMaxValues(Math.min(kinds.length, selectOptionLimit))
      .addOptions(kindOptions(t, kinds, selected)),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening panel edit modal',
 });
};

export const panelLabelPick = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const [settingsId] = cmd.data.values;

 const kind = await this.client.db.client.ticketSetting.findFirst({
  where: { id: settingsId, guild: cmd.guild_id },
 });
 if (!kind) {
  panelWarn.call(this, cmd, t.panel.errors.notFound());
  return;
 }

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.PanelLabelSave, kind.id))
  .setTitle(systemDisplayLabel(t, kind).slice(0, 45))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.settings.fields.panelButtonLabel())
    .setDescription(t.settings.descriptions.panelButtonLabel())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('label')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(80)
      .setPlaceholder(t.startTicket())
      .setValue(kind.panelButtonLabel ?? ''),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening panel button label modal',
 });
};

export const panelLabelSave = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const [settingsId] = args;

 const kind = await this.client.db.client.ticketSetting.findFirst({
  where: { id: settingsId, guild: cmd.guild_id },
 });
 if (!kind) {
  panelWarn.call(this, cmd, t.panel.errors.notFound());
  return;
 }

 const label = (findModalValue(cmd.data.components, 'label') || '').trim();
 const updated = await this.client.db.client.ticketSetting
  .updateMany({
   where: { id: settingsId, guild: cmd.guild_id },
   data: { panelButtonLabel: label || null },
  })
  .catch((error: Error) => error);
 if (updated instanceof Error) {
  this.nonFatalError(updated, 'panelLabelSave');
  panelWarn.call(this, cmd, t.base.errors.unknownError());
  return;
 }

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const posted = panels.filter(
  (panel) => panel.message && panel.kinds.map((k) => String(k)).includes(settingsId),
 );
 for (const panel of posted) {
  await renderHubPanel.call(this, panel);
 }

 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, 0);
 payload.update(cmd);
};

export const panelSave = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const channel = findModalValues(cmd.data.components, 'channel')[0] || null;
 const kinds = findModalValues(cmd.data.components, 'kinds');

 if (!kinds.length) {
  panelWarn.call(this, cmd, t.panel.errors.kindsRequired());
  return;
 }

 if (args.length) {
  const panel = await TicketPanel.byId(this.client, args[0]);
  if (!panel || panel.guild !== cmd.guild_id) {
   panelWarn.call(this, cmd, t.panel.errors.notFound());
   return;
  }

  const edited = await new TicketPanel(this.client, cmd.guild_id, args[0])
   .update({ channel, kinds })
   .catch((error: Error) => error);
  if (edited instanceof Error) {
   this.nonFatalError(edited, 'panelSave.edit');
   panelWarn.call(this, cmd, t.base.errors.unknownError());
   return;
  }
 } else {
  const created = await TicketPanel.create(this.client, cmd.guild_id, { channel, kinds }).catch(
   (error: Error) => {
    this.nonFatalError(error, 'panelSave.create');
    return null;
   },
  );
  if (!created) {
   panelWarn.call(this, cmd, t.base.errors.unknownError());
   return;
  }
 }

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, 0);
 payload.update(cmd);
};
