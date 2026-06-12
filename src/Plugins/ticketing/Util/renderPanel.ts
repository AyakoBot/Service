import type { TicketPanel as TicketPanelRow, TicketSetting } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 EmbedBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 type APIEmbed,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../Types/index.js';
import { TicketRoute } from '../Classes/Routes.js';
import TicketPanel from '../Classes/TicketPanel.js';
import type TicketPlugin from '../Plugin.js';

export const buttonLimit = 5;

const kindLabel = (settings: TicketSetting, fallback: string) =>
 (settings.panelButtonLabel || fallback).slice(0, 80);

const defaultEmbed = (description: string) =>
 new EmbedBuilder().setDescription(description).setColor(Colors.Info);

export const buildHubPayload = async function (
 this: TicketPlugin,
 panel: TicketPanelRow,
 kinds: TicketSetting[],
) {
 const t = await this.t(panel.guild);

 const embed = panel.embed
  ? (panel.embed as APIEmbed)
  : defaultEmbed(t.panel.hubDesc()).toJSON();

 const components: APIMessageTopLevelComponent[] = [];

 if (kinds.length <= buttonLimit) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
   kinds.map((kind) =>
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.getRoute(TicketRoute.Create, kind.id))
     .setLabel(kindLabel(kind, t.startTicket())),
   ),
  );
  components.push(row.toJSON() as unknown as APIMessageTopLevelComponent);
 } else {
  const select = new StringSelectMenuBuilder()
   .setCustomId(this.getRoute(TicketRoute.PanelPick, panel.id))
   .setPlaceholder(t.panel.pickKind())
   .addOptions(
    kinds
     .slice(0, 25)
     .map((kind) =>
      new StringSelectMenuOptionBuilder()
       .setLabel(kindLabel(kind, t.startTicket()))
       .setValue(String(kind.id)),
     ),
   );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  components.push(row.toJSON() as unknown as APIMessageTopLevelComponent);
 }

 return new MessagePayload(this.client, { origin: this.name, reason: 'Multi-kind ticket panel' })
  .setEmbeds([embed])
  .setComponents(components);
};

const postOrEdit = async function (
 this: TicketPlugin,
 guildId: string,
 channelId: string,
 currentMessage: string | null,
 payload: MessagePayload,
): Promise<string | null> {
 if (currentMessage) {
  const edited = await payload.edit(channelId, currentMessage).catch((error: Error) => {
   this.nonFatalError(error, 'renderPanel.edit');
   return null;
  });
  if (edited && !(edited instanceof Error)) return currentMessage;
 }

 const sent = await payload
  .setSendTo([{ channel: channelId, guildId }])
  .send()
  .then((messages) => messages[0])
  .catch((error: Error) => {
   this.nonFatalError(error, 'renderPanel.send');
   return undefined;
  });

 return sent && 'id' in sent ? sent.id : null;
};

export const renderHubPanel = async function (
 this: TicketPlugin,
 panel: TicketPanelRow,
): Promise<string | null> {
 if (!panel.channel) return null;

 const ids = panel.kinds.map((k) => String(k));
 const kinds = await this.client.db.client.ticketSetting.findMany({
  where: { id: { in: ids }, guild: panel.guild, active: true },
 });
 if (!kinds.length) return null;

 const payload = await buildHubPayload.call(this, panel, kinds);
 const messageId = await postOrEdit.call(this, panel.guild, panel.channel, panel.message, payload);

 if (messageId && messageId !== panel.message) {
  await new TicketPanel(this.client, panel.guild, String(panel.id))
   .setMessage(messageId)
   .catch((error: Error) => this.nonFatalError(error, 'renderHubPanel.persist'));
 }

 return messageId;
};
