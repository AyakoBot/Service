import type { TicketSetting } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 EmbedBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../Types/index.js';
import { TicketRoute } from '../Classes/Routes.js';
import type TicketPlugin from '../Plugin.js';

import type { OpenableKind } from './getOpenableKinds.js';
import type { CandidateGuild } from './getSharedTicketGuilds.js';

const quote = (content: string, max = 400) => {
 const trimmed = content.replace(/\r/g, '').trim();
 const sliced = trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
 return sliced
  .split('\n')
  .map((line) => `> ${line}`)
  .join('\n');
};

const kindLabel = (settings: TicketSetting, fallback: string) =>
 (settings.panelButtonLabel || fallback).slice(0, 100);

export const buildGreetingPayload = async function (
 this: TicketPlugin,
 firstMessage: string,
 attachmentUrls: string[] = [],
 stuckTicketId?: string,
 prefix?: string,
) {
 const t = await this.t(undefined);

 const quoted = [
  firstMessage.trim() ? quote(firstMessage) : '',
  ...attachmentUrls.map((url) => `> ${url}`),
 ]
  .filter(Boolean)
  .join('\n');

 const description = [
  prefix,
  t.intake.greeting(),
  stuckTicketId ? t.intake.unreachableNotice() : undefined,
  quoted,
 ]
  .filter(Boolean)
  .join('\n\n');

 const row = new ActionRowBuilder<ButtonBuilder>();

 if (stuckTicketId) {
  row.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(this.getRoute(TicketRoute.IntakeUnreachable, stuckTicketId))
    .setLabel(t.intake.unreachableButton()),
  );
 }

 row.addComponents(
  new ButtonBuilder()
   .setStyle(stuckTicketId ? ButtonStyle.Secondary : ButtonStyle.Primary)
   .setCustomId(this.getRoute(TicketRoute.IntakeOpen))
   .setLabel(t.intake.openButton()),
 );

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake greeting' })
  .setEmbeds([new EmbedBuilder().setDescription(description).setColor(Colors.Info)])
  .setComponents([row.toJSON() as unknown as APIMessageTopLevelComponent]);
};

export const buildEndPayload = async function (this: TicketPlugin, reason: string) {
 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake end' })
  .setEmbeds([new EmbedBuilder().setDescription(reason).setColor(Colors.Warning)])
  .setComponents([]);
};

export const buildServerSelectPayload = async function (
 this: TicketPlugin,
 candidates: CandidateGuild[],
) {
 const t = await this.t(undefined);

 const options: StringSelectMenuOptionBuilder[] = [];
 for (const candidate of candidates.slice(0, 25)) {
  const guild = await this.client.cache.guilds.get(candidate.guildId);
  options.push(
   new StringSelectMenuOptionBuilder()
    .setLabel((guild?.name || candidate.guildId).slice(0, 100))
    .setValue(candidate.guildId),
  );
 }

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(TicketRoute.IntakeServer))
  .setPlaceholder(t.intake.pickServer())
  .addOptions(options);

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake server pick' })
  .setEmbeds([new EmbedBuilder().setDescription(t.intake.chooseServer()).setColor(Colors.Info)])
  .setComponents([
   new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(select)
    .toJSON() as unknown as APIMessageTopLevelComponent,
  ]);
};

export const buildKindSelectPayload = async function (
 this: TicketPlugin,
 guildId: string,
 kinds: OpenableKind[],
) {
 const t = await this.t(guildId);

 const options = kinds
  .slice(0, 25)
  .map((kind) =>
   new StringSelectMenuOptionBuilder()
    .setLabel(kindLabel(kind.settings, t.startTicket()))
    .setValue(String(kind.settings.id)),
  );

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(TicketRoute.IntakeKind, guildId))
  .setPlaceholder(t.intake.pickKind())
  .addOptions(options);

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake kind pick' })
  .setEmbeds([new EmbedBuilder().setDescription(t.intake.chooseKind()).setColor(Colors.Info)])
  .setComponents([
   new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(select)
    .toJSON() as unknown as APIMessageTopLevelComponent,
  ]);
};

export const buildExistingPayload = async function (
 this: TicketPlugin,
 guildId: string,
 ticketId: string,
) {
 const t = await this.t(guildId);

 const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.IntakeExisting, ticketId))
   .setLabel(t.intake.goToExisting()),
 );

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake limit hit' })
  .setEmbeds([new EmbedBuilder().setDescription(t.intake.limitReached()).setColor(Colors.Warning)])
  .setComponents([row.toJSON() as unknown as APIMessageTopLevelComponent]);
};
