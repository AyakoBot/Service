import type { Snippets } from '@ayako/database';
import { TicketType } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import type BaseTicket from '../Classes/BaseTicket.js';
import type TicketPlugin from '../Plugin.js';

import resolveSnippetVars from './resolveSnippetVars.js';
import { resolveTicketByChannel, resolveTicketByStaffThread } from './resolveTicket.js';

const dmTypes = [TicketType.dmToChannel, TicketType.dmToThread];

const buildSyntheticMessage = (
 staffId: string,
 guildId: string,
 channelId: string,
 content: string,
): RMessage =>
 ({
  id: String(Date.now()),
  channel_id: channelId,
  author_id: staffId,
  guild_id: guildId,
  content,
  timestamp: new Date().toISOString(),
  attachments: [],
  sticker_items: [],
  embeds: [],
 }) as unknown as RMessage;

export default async function (
 this: TicketPlugin,
 cmd: APIInteraction,
 snippet: Snippets,
 channelId: string,
 staffId: string,
 guildId: string,
) {
 const t = await this.t(guildId);

 const ticket =
  (await resolveTicketByChannel.call(this.client, channelId)) ||
  (await resolveTicketByStaffThread.call(this.client, channelId));

 if (!ticket) {
  showError.call(this, cmd, t.base.t.error(), t.tag.errors.noTicket());
  return;
 }

 const dbTicket = await ticket.getTicket();
 const ctx = { guildId, staffId, ticket: dbTicket };

 const userText = snippet.userText
  ? await resolveSnippetVars.call(this.client, snippet.userText, ctx)
  : '';
 const staffText = snippet.staffText
  ? await resolveSnippetVars.call(this.client, snippet.staffText, ctx)
  : '';

 if (userText.trim()) await relayUserText.call(this, ticket, staffId, guildId, userText);
 if (staffText.trim()) await postStaffNote.call(this, ticket, staffId, guildId, staffText);

 new MessagePayload(this.client, { origin: this.name, reason: 'Confirming snippet post' })
  .setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Success)
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `${constants.formatters.getEmote(emotes.info)} ${t.tag.posted({ name: snippet.name })}`,
     ),
    )
    .toJSON(),
  ])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .reply(cmd);
}

const relayUserText = async function (
 this: TicketPlugin,
 ticket: BaseTicket,
 staffId: string,
 guildId: string,
 content: string,
) {
 const dbTicket = await ticket.getTicket();
 const msg = buildSyntheticMessage(staffId, guildId, dbTicket.channel, content);

 if (dmTypes.includes(dbTicket.settings.type) && 'cloneToDm' in ticket) {
  await (ticket as BaseTicket & { cloneToDm: (m: RMessage) => Promise<boolean> }).cloneToDm(msg);
  return;
 }

 await ticket.forwardToTicketChannel(msg);
};

const postStaffNote = async function (
 this: TicketPlugin,
 ticket: BaseTicket,
 staffId: string,
 guildId: string,
 content: string,
) {
 const msg = buildSyntheticMessage(staffId, guildId, '', content);
 const container = await ticket.buildInternalNoteContainer(msg, staffId, true);

 await ticket
  .sendMessage(
   new MessagePayload(this.client, {
    origin: this.name,
    reason: 'Posting snippet internal note',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  )
  .catch((error: Error) => this.nonFatalError(error, 'runSnippet.postStaffNote'));
};

const showError = function (
 this: TicketPlugin,
 cmd: APIInteraction,
 title: string,
 description: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Snippet error' })
  .setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Danger)
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `${constants.formatters.getEmote(emotes.warning)} **${title}**\n${description}`,
     ),
    )
    .toJSON(),
  ])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .reply(cmd);
};
