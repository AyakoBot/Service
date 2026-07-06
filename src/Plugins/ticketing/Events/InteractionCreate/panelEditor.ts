import type { TicketPanel as TicketPanelRow } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import {
 EmbedBuilderCommand,
 EmbedBuilderSubcommand,
} from '../../../embedBuilder/Classes/Commands.js';
import { PageDirection } from '../../Classes/Enums.js';
import { TicketRoute } from '../../Classes/Routes.js';
import TicketPanel from '../../Classes/TicketPanel.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { renderHubPanel } from '../../Util/renderPanel.js';
import { systemDisplayLabel } from '../../Util/systemLabel.js';

export const panelPageSize = 5;
export const selectOptionLimit = 25;

export const buildPanelEditor = async function (
 this: TicketPlugin,
 guildId: string,
 panels: TicketPanelRow[],
 page: number,
) {
 const t = await this.t(guildId);
 const pageCount = Math.max(1, Math.ceil(panels.length / panelPageSize));
 const safePage = Math.min(Math.max(0, page), pageCount - 1);
 const start = safePage * panelPageSize;
 const slice = panels.slice(start, start + panelPageSize);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `${constants.formatters.getEmote(emotes.message)} **${t.panel.editorTitle()}**`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 if (!slice.length) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t.panel.empty()));
 }

 slice.forEach((panel, sliceIndex) => {
  const index = start + sliceIndex;
  const channel = panel.channel ? `<#${panel.channel}>` : t.base.t.none();
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `-# ${index + 1}. ${channel} → ${t.panel.kindCount({ count: String(panel.kinds.length) })}`,
   ),
  );

  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.getRoute(TicketRoute.PanelEdit, panel.id))
     .setLabel(t.base.t.Edit()),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Success)
     .setCustomId(this.getRoute(TicketRoute.PanelPost, panel.id))
     .setLabel(t.panel.post()),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Danger)
     .setCustomId(this.getRoute(TicketRoute.PanelRemove, panel.id))
     .setLabel(t.base.t.Delete()),
   ),
  );
 });

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `-# ${t.panel.editHint({
    command: `\`/${EmbedBuilderCommand.EmbedBuilder} ${EmbedBuilderSubcommand.Create}\``,
   })}`,
  ),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`-# ${t.base.t.Page()} ${safePage + 1}/${pageCount}`),
 );

 const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.PanelPage, PageDirection.Prev, safePage))
   .setLabel('←')
   .setDisabled(safePage <= 0),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.PanelPage, PageDirection.Next, safePage))
   .setLabel('→')
   .setDisabled(safePage >= pageCount - 1),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(TicketRoute.PanelAdd))
   .setLabel(t.base.t.Add()),
 );

 const components: APIMessageTopLevelComponent[] = [container.toJSON()];

 const kinds = await this.client.db.client.ticketSetting.findMany({
  where: { guild: guildId },
 });
 if (kinds.length) {
  const labelSelect = new StringSelectMenuBuilder()
   .setCustomId(this.getRoute(TicketRoute.PanelLabel))
   .setPlaceholder(t.panel.labelPlaceholder())
   .setMinValues(1)
   .setMaxValues(1)
   .addOptions(
    kinds
     .slice(0, selectOptionLimit)
     .map((kind) =>
      new StringSelectMenuOptionBuilder()
       .setLabel(systemDisplayLabel(t, kind).slice(0, 100))
       .setDescription((kind.panelButtonLabel || t.startTicket()).slice(0, 100))
       .setValue(String(kind.id)),
     ),
   );
  components.push(
   new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(labelSelect)
    .toJSON() as unknown as APIMessageTopLevelComponent,
  );
 }

 components.push(nav.toJSON() as unknown as APIMessageTopLevelComponent);

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket panel editor' })
  .setComponents(components)
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

export const panelEditorOpen = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, 0);
 payload.reply(cmd);
};

export const panelPage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [dir, currentArg] = args;
 const current = Number(currentArg) || 0;
 const page = dir === PageDirection.Next ? current + 1 : current - 1;

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, page);
 payload.update(cmd);
};

export const panelRemove = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const removed = await new TicketPanel(this.client, cmd.guild_id, args[0])
  .remove()
  .catch((error: Error) => error);
 if (removed instanceof Error) {
  this.nonFatalError(removed, 'panelRemove');
  panelWarn.call(this, cmd, (await this.t(cmd.guild_id)).base.errors.unknownError());
  return;
 }

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, 0);
 payload.update(cmd);
};

export const panelPost = async function (
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
 if (!panel.channel) {
  panelWarn.call(this, cmd, t.panel.errors.channelRequired());
  return;
 }

 const messageId = await renderHubPanel.call(this, panel);
 panelWarn.call(this, cmd, messageId ? t.panel.posted() : t.panel.errors.postFailed());
};

export const panelWarn = function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Ticket panel editor warning' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
