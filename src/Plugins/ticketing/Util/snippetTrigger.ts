/* eslint-disable @typescript-eslint/naming-convention */
import { MessageFlags, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../Types/gateway.js';
import { TicketRoute } from '../Classes/Routes.js';
import Snippet from '../Classes/Snippet.js';
import type TicketPlugin from '../Plugin.js';

import { savePick } from './contactPick.js';
import getForceOpenableKinds from './getForceOpenableKinds.js';
import isSettingsStaff from './isSettingsStaff.js';
import { resolveTicketByChannel, resolveTicketByStaffThread } from './resolveTicket.js';
import { outcomeContainer, postSnippet, TagFeedback } from './runSnippet.js';
import { parseTagCommands, planContact, TagStage, tagIssue } from './tagCommands.js';

type MessageCreateData = ExtractPayload<GatewayDispatchEvents.MessageCreate>;
type SnippetMatch = NonNullable<Awaited<ReturnType<typeof Snippet.matchTrigger>>>;

const mayContact = async function (
 this: TicketPlugin,
 msg: MessageCreateData,
 guildId: string,
 systemId: string,
): Promise<boolean> {
 const roles = msg.member?.roles ?? [];

 if (!systemId) {
  const candidates = await getForceOpenableKinds.call(this, guildId, msg.author.id, roles);
  return candidates.some((entry) => !entry.block);
 }

 const settings = await this.client.db.client.ticketSetting.findFirst({
  where: { id: systemId, guild: guildId },
 });
 return !!settings && isSettingsStaff(settings, msg.author.id, roles);
};

const contactTrigger = async function (
 this: TicketPlugin,
 msg: MessageCreateData,
 guildId: string,
 match: SnippetMatch,
 systemId: string,
): Promise<boolean> {
 if (!(await mayContact.call(this, msg, guildId, systemId))) return false;

 const run = {
  channelId: msg.channel_id,
  staffId: msg.author.id,
  guildId,
  input: match.input,
  feedback: TagFeedback.Note,
 };
 const outcome = await postSnippet.call(this, match.snippet, run);
 if (outcome.pick)
  await savePick.call(this, msg.id, { ...run, snippetId: String(match.snippet.id) });

 const api = await this.getAPI(guildId);
 const t = await this.t(guildId);
 const container = outcomeContainer(
  t,
  this.client.emojis.for(api),
  match.snippet,
  outcome,
  this.getRoute(TicketRoute.ContactPick, msg.id),
 );

 await api.channels.createMessage(
  msg.channel_id,
  {
   components: [container.toJSON()],
   flags: MessageFlags.IsComponentsV2,
   message_reference: { message_id: msg.id, fail_if_not_exists: false },
   allowed_mentions: { parse: [] },
  },
  { origin: this.name, reason: 'Reporting a snippet contact' },
 );

 return true;
};

export const snippetTrigger = async function (
 this: TicketPlugin,
 msg: MessageCreateData,
): Promise<boolean> {
 if (!msg.guild_id) return false;

 const content = (msg.content || '').trim();
 if (!content) return false;

 const match = await Snippet.matchTrigger(this.client, msg.guild_id, content);
 if (!match) return false;

 const contact = planContact(parseTagCommands(match.snippet.commands), match.input);
 if (contact) {
  if (tagIssue(contact.step, TagStage.Run)) return false;
  return contactTrigger.call(this, msg, msg.guild_id, match, contact.step.value);
 }

 const ticket =
  (await resolveTicketByChannel.call(this.client, msg.channel_id)) ||
  (await resolveTicketByStaffThread.call(this.client, msg.channel_id));

 if (!ticket) return false;

 const dbTicket = await ticket.getTicket();
 if (!isSettingsStaff(dbTicket.settings, msg.author.id, msg.member?.roles ?? [])) return false;

 const { failure } = await postSnippet.call(this, match.snippet, {
  channelId: msg.channel_id,
  staffId: msg.author.id,
  guildId: msg.guild_id,
  input: match.input,
  feedback: TagFeedback.Note,
 });

 if (failure) this.nonFatalError(new Error(failure), 'snippetTrigger');

 return true;
};
