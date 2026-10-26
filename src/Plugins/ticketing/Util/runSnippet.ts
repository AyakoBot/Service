import type { Snippets, TicketSetting } from '@ayako/database';
import { TicketState, TicketType } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import {
 ActionRowBuilder,
 ContainerBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../Types/index.js';
import type BaseTicket from '../Classes/BaseTicket.js';
import type ChannelTicket from '../Classes/ChannelTicket.js';
import { SnippetErrors } from '../Classes/Enums.js';
import { TicketRoute } from '../Classes/Routes.js';
import type TicketPlugin from '../Plugin.js';

import { savePick } from './contactPick.js';
import resolveSnippetVars from './resolveSnippetVars.js';
import { resolveTicketByChannel, resolveTicketByStaffThread } from './resolveTicket.js';
import { openContact, runTagCommands } from './runTagCommands.js';
import { snippetErrorText } from './snippetErrorText.js';
import { systemDisplayLabel } from './systemLabel.js';
import { idOf, parseTagCommands, planContact, type TagStep } from './tagCommands.js';

const dmTypes = [TicketType.dmToChannel, TicketType.dmToThread];

const reachesMember = (ticket: {
 state: TicketState;
 dm: string | null;
 settings: { type: TicketType };
}) =>
 ticket.state !== TicketState.closed && (!!ticket.dm || !dmTypes.includes(ticket.settings.type));

export enum TagFeedback {
 Reply = 'reply',
 Note = 'note',
}

export interface SnippetOutcome {
 failure: SnippetErrors | null;
 warnings: string[];
 opened: { channel: string; user: string } | null;
 pick: { user: string; choices: TicketSetting[] } | null;
}

export interface SnippetRun {
 channelId: string;
 staffId: string;
 guildId: string;
 input: string;
 feedback: TagFeedback;
 systemId?: string;
}

interface DeliverOptions {
 steps: TagStep[];
 input: string;
 feedback: TagFeedback;
}

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

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

const deliver = async function (
 this: ChannelTicket,
 snippet: Snippets,
 staffId: string,
 guildId: string,
 { steps, input, feedback }: DeliverOptions,
): Promise<SnippetOutcome> {
 const { plugin } = this;
 const api = await plugin.getAPI(guildId);
 const emotes = plugin.client.emojis.for(api);

 const dbTicket = await this.getTicket();
 const ctx = { guildId, staffId, ticket: dbTicket, emotes };

 const userText =
  snippet.userText && reachesMember(dbTicket)
   ? await resolveSnippetVars.call(plugin.client, snippet.userText, ctx)
   : '';
 const staffText = snippet.staffText
  ? await resolveSnippetVars.call(plugin.client, snippet.staffText, ctx)
  : '';

 if (userText.trim() && !(await relayUserText.call(plugin, this, staffId, guildId, userText))) {
  return { failure: SnippetErrors.dmFailed, warnings: [], opened: null, pick: null };
 }

 if (staffText.trim()) await postStaffNote.call(plugin, this, staffId, guildId, staffText);
 else if (userText.trim() && dmTypes.includes(dbTicket.settings.type)) {
  await this.forwardToTicketChannel(
   buildSyntheticMessage(staffId, guildId, dbTicket.channel, userText),
  );
 }

 const warnings = await runTagCommands.call(this, staffId, steps, input);
 const deleted = (await this.getTicket()).state === TicketState.deleted;

 if (warnings.length && feedback === TagFeedback.Note && !deleted) {
  const t = await plugin.t(guildId);
  const note = [t.tag.commands.noteTitle({ name: snippet.name }), ...warnings].join('\n');
  await postStaffNote.call(plugin, this, staffId, guildId, note);
 }

 return { failure: null, warnings, opened: null, pick: null };
};

export const postSnippet = async function (
 this: TicketPlugin,
 snippet: Snippets,
 { channelId, staffId, guildId, input, feedback, systemId }: SnippetRun,
): Promise<SnippetOutcome> {
 const steps = parseTagCommands(snippet.commands);
 const contact = planContact(steps, input);

 if (!contact) {
  const ticket =
   (await resolveTicketByChannel.call(this.client, channelId)) ||
   (await resolveTicketByStaffThread.call(this.client, channelId));
  if (!ticket) return { failure: SnippetErrors.noTicket, warnings: [], opened: null, pick: null };

  return deliver.call(ticket, snippet, staffId, guildId, { steps, input, feedback });
 }

 const opened = await openContact.call(this, guildId, staffId, contact, systemId);
 if (opened.choices) {
  return {
   failure: null,
   warnings: opened.warnings,
   opened: null,
   pick: { user: idOf(contact.user) ?? contact.user, choices: opened.choices },
  };
 }
 if (!opened.ticket) {
  return {
   failure: SnippetErrors.contactFailed,
   warnings: opened.warnings,
   opened: null,
   pick: null,
  };
 }

 const outcome = await deliver.call(opened.ticket, snippet, staffId, guildId, {
  steps: contact.steps,
  input: contact.input,
  feedback: TagFeedback.Note,
 });
 const row = await opened.ticket.getTicket();

 return {
  ...outcome,
  warnings: [...opened.warnings, ...outcome.warnings],
  opened: { channel: row.channel, user: row.user },
 };
};

const notice = (color: Colors, lines: string[]) =>
 new ContainerBuilder()
  .setAccentColor(color)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

const outcomeColor = ({ failure, warnings, pick }: SnippetOutcome): Colors => {
 if (failure) return Colors.Danger;
 if (pick) return Colors.Info;
 return warnings.length ? Colors.Warning : Colors.Success;
};

const outcomeLines = (
 t: Translator,
 emotes: EmoteSet,
 snippet: Snippets,
 { failure, warnings, opened, pick }: SnippetOutcome,
): string[] => {
 const emote = constants.formatters.getEmote;
 const warningLines = warnings.map((warning) => `${emote(emotes.warning)} ${warning}`);

 if (failure) {
  const vars = { name: snippet.name, trigger: snippet.trigger || '' };
  return [
   `${emote(emotes.warning)} **${t.base.t.error()}**`,
   snippetErrorText(t, failure, vars),
   ...warningLines,
  ];
 }

 if (pick) {
  return [
   `${emote(emotes.ticket)} ${t.tag.commands.pickSystem({ user: `<@${pick.user}>` })}`,
   ...warningLines,
  ];
 }

 const headline = opened
  ? `${emote(emotes.ticket)} ${t.tag.commands.opened({
     channel: `<#${opened.channel}>`,
     user: `<@${opened.user}>`,
    })}`
  : `${emote(emotes.info)} ${t.tag.posted({ name: snippet.name })}`;

 return [headline, ...warningLines];
};

export const outcomeContainer = (
 t: Translator,
 emotes: EmoteSet,
 snippet: Snippets,
 outcome: SnippetOutcome,
 pickId: string,
) => {
 const container = notice(outcomeColor(outcome), outcomeLines(t, emotes, snippet, outcome));
 if (!outcome.pick || !pickId) return container;

 return container.addActionRowComponents(
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
   new StringSelectMenuBuilder()
    .setCustomId(pickId)
    .setPlaceholder(t.tag.commands.pickPlaceholder())
    .setOptions(
     outcome.pick.choices
      .slice(0, 25)
      .map((setting) =>
       new StringSelectMenuOptionBuilder()
        .setLabel(systemDisplayLabel(t, setting).slice(0, 100))
        .setValue(String(setting.id)),
      ),
    ),
  ),
 );
};

export default async function (
 this: TicketPlugin,
 cmd: APIInteraction,
 snippet: Snippets,
 channelId: string,
 staffId: string,
 guildId: string,
 input: string,
) {
 const api = await this.getInteractionAPI(cmd);
 const meta = { origin: this.name, reason: 'Running a snippet' };
 await api.interactions.defer(cmd.id, cmd.token, { flags: MessageFlags.Ephemeral }, meta);

 const t = await this.t(guildId);
 const emotes = this.client.emojis.forApp(cmd.application_id);

 const run = { channelId, staffId, guildId, input, feedback: TagFeedback.Reply };
 const outcome = await postSnippet.call(this, snippet, run);
 if (outcome.pick) await savePick.call(this, cmd.id, { ...run, snippetId: String(snippet.id) });

 const pickId = this.getRoute(TicketRoute.ContactPick, cmd.id);

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  '@original',
  {
   components: [outcomeContainer(t, emotes, snippet, outcome, pickId).toJSON()],
   flags: MessageFlags.IsComponentsV2,
   allowed_mentions: { parse: [] },
  },
  meta,
 );
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
  return (ticket as BaseTicket & { cloneToDm: (m: RMessage) => Promise<boolean> }).cloneToDm(msg);
 }

 await ticket.forwardToTicketChannel(msg);
 await ticket.claimOnReply(staffId);
 return true;
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
