import { RequestHandlerError, type API } from '@ayako/api';
import { TicketState } from '@ayako/database';
import type { Ticket, TicketSetting, TicketTier } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import {
 arm,
 dataKey,
 disarm,
 isArmed,
 scanDataKeys,
 stripDataPrefix,
 stripMarkerPrefix,
} from '../../../Util/schedule.js';
import type BaseTicket from '../Classes/BaseTicket.js';
import { TicketRoute } from '../Classes/Routes.js';
import type TicketPlugin from '../Plugin.js';
import getTicketClassById from '../Util/getTicketClassById.js';

import {
 encodeJob,
 parseTicketKey,
 positiveSeconds,
 type RemindJob,
 RemindKind,
 remindKey,
 ticketKey,
 type WarningRef,
} from './keys.js';

type TicketRow = Ticket & { settings: TicketSetting };
type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

const concurrency = 5;

const warningRef = (message: { id: string; channel_id: string }, dm: boolean): WarningRef => ({
 channelId: message.channel_id,
 messageId: message.id,
 dm,
});

const jitter = () =>
 new Promise<void>((resolve) => setTimeout(resolve, Math.floor(Math.random() * 750)));

const runPool = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
 let index = 0;

 const runner = async () => {
  while (index < items.length) {
   const current = items[index];
   index += 1;
   await jitter();
   await worker(current);
  }
 };

 await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
};

export default class TicketReminders {
 plugin: TicketPlugin;
 client: Client;

 constructor(plugin: TicketPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 armKind = async (ticket: TicketRow, kind: RemindKind, after: number, warnings?: WarningRef[]) => {
  const key = remindKey(kind, String(ticket.id));
  if (after <= 0) {
   await disarm.call(this.client, key);
   return;
  }

  await arm.call(
   this.client,
   key,
   encodeJob({ guildId: ticket.settings.guild, ticketId: String(ticket.id), kind, warnings }),
   after,
  );
 };

 disarmKinds = async (ticketId: string, kinds: RemindKind[]) => {
  await Promise.all(kinds.map((kind) => disarm.call(this.client, remindKey(kind, ticketId))));
 };

 setRemindAt = async (ticketId: string, epochMs: number | null) => {
  await this.client.db.client.ticket
   .update({ where: { id: ticketId }, data: { remindAt: epochMs } })
   .catch((error: Error) => this.plugin.nonFatalError(error, 'setRemindAt'));
 };

 tierUnclaimedSeconds = async (ticket: TicketRow): Promise<number> => {
  if (!ticket.tierId) return positiveSeconds(ticket.settings.remindUnclaimedAfter);

  const tier = await this.client.db.client.ticketTier
   .findUnique({ where: { id: String(ticket.tierId) } })
   .catch(() => null);

  const tierSeconds = positiveSeconds(tier?.reminderSeconds);
  return tierSeconds > 0 ? tierSeconds : positiveSeconds(ticket.settings.remindUnclaimedAfter);
 };

 armTierReminder = async (ticket: TicketRow, tier: TicketTier) => {
  const after =
   positiveSeconds(tier.reminderSeconds) || positiveSeconds(ticket.settings.remindUnclaimedAfter);
  await disarm.call(this.client, remindKey(RemindKind.Unclaimed, String(ticket.id)));
  await this.armKind(ticket, RemindKind.Unclaimed, after);
 };

 armForState = async (ticket: TicketRow) => {
  const id = String(ticket.id);
  const { settings } = ticket;

  const warnAfter = positiveSeconds(settings.inactivityWarnAfter);

  if (ticket.state === TicketState.opened) {
   await this.armKind(ticket, RemindKind.Unclaimed, await this.tierUnclaimedSeconds(ticket));
   await this.disarmKinds(id, [RemindKind.Stale, RemindKind.InactivityClose]);
   await this.armKind(ticket, RemindKind.InactivityWarn, warnAfter);
   await this.setRemindAt(id, warnAfter > 0 ? Date.now() + warnAfter * 1000 : null);
   return;
  }

  if (ticket.state === TicketState.claimed) {
   await this.disarmKinds(id, [RemindKind.Unclaimed, RemindKind.InactivityClose]);
   await this.armKind(ticket, RemindKind.Stale, positiveSeconds(settings.remindStaleAfter));
   await this.armKind(ticket, RemindKind.InactivityWarn, warnAfter);
   await this.setRemindAt(id, warnAfter > 0 ? Date.now() + warnAfter * 1000 : null);
   return;
  }

  await this.disarmKinds(id, [
   RemindKind.Unclaimed,
   RemindKind.Stale,
   RemindKind.InactivityWarn,
   RemindKind.InactivityClose,
  ]);
  await this.setRemindAt(id, null);
 };

 resetActivityTimers = async (ticket: TicketRow) => {
  if (ticket.state !== TicketState.opened && ticket.state !== TicketState.claimed) return;

  const id = String(ticket.id);
  const { settings } = ticket;
  const warnAfter = positiveSeconds(settings.inactivityWarnAfter);

  await disarm.call(this.client, remindKey(RemindKind.InactivityClose, id));
  await this.armKind(ticket, RemindKind.InactivityWarn, warnAfter);

  if (ticket.state === TicketState.claimed) {
   await this.armKind(ticket, RemindKind.Stale, positiveSeconds(settings.remindStaleAfter));
  }

  await this.setRemindAt(id, warnAfter > 0 ? Date.now() + warnAfter * 1000 : null);
 };

 armCloseAfterWarn = async (ticket: TicketRow, warnings: WarningRef[] = []) => {
  const closeAfter = positiveSeconds(ticket.settings.inactivityCloseAfter);
  await this.armKind(ticket, RemindKind.InactivityClose, closeAfter, warnings);
  const remindAt = closeAfter > 0 ? Date.now() + closeAfter * 1000 : null;
  await this.setRemindAt(String(ticket.id), remindAt);
 };

 disarmInactivity = async (ticketId: string) => {
  await this.disarmKinds(ticketId, [RemindKind.InactivityWarn, RemindKind.InactivityClose]);
  await this.setRemindAt(ticketId, null);
 };

 storedWarnings = async (ticketId: string): Promise<WarningRef[]> => {
  const key = dataKey(remindKey(RemindKind.InactivityClose, ticketId));
  const raw = await this.client.cache.scheduleDb?.get(key);
  return raw ? ((JSON.parse(raw) as RemindJob).warnings ?? []) : [];
 };

 nextCheckUnix = (ticket: TicketRow): number | null => {
  const warnAfter = positiveSeconds(ticket.settings.inactivityWarnAfter);
  const open = ticket.state === TicketState.opened || ticket.state === TicketState.claimed;
  return open && warnAfter > 0 ? Math.floor(Date.now() / 1000) + warnAfter : null;
 };

 restartInactivity = async (ticket: TicketRow) => {
  const id = String(ticket.id);
  await this.disarmInactivity(id);
  if (!this.nextCheckUnix(ticket)) return;

  const warnAfter = positiveSeconds(ticket.settings.inactivityWarnAfter);
  await this.armKind(ticket, RemindKind.InactivityWarn, warnAfter);
  await this.setRemindAt(id, Date.now() + warnAfter * 1000);
 };

 postWarning = async (api: API, ticket: TicketRow, payload: MessagePayload) => {
  const sent = await api.channels.createMessage(ticket.channel, payload.getAPIPayload(), {
   origin: payload.origin,
   reason: payload.reason,
  });
  if (!(sent instanceof RequestHandlerError)) return warningRef(sent, false);

  this.plugin.nonFatalError(sent, 'fireInactivityWarn');
  return null;
 };

 editWarning = async (ticket: TicketRow, ref: WarningRef, payload: MessagePayload) => {
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const meta = { origin: payload.origin, reason: payload.reason };
  const body = payload.getAPIPayload();
  const res = ref.dm
   ? await api.channels.editDirectMessage(ref.channelId, ref.messageId, body, meta)
   : await api.channels.editMessage(ref.channelId, ref.messageId, body, meta);

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'editWarning');
 };

 reArm = async (ticket: BaseTicket, kind: RemindKind, every: number) => {
  const row = await ticket.getTicket();
  await this.armKind(row, kind, every);
 };

 sendPing = async (ticket: BaseTicket, content: string, roles: string[], users: string[]) => {
  const payload = new MessagePayload(this.client, {
   origin: 'ticketReminder',
   reason: 'Sending ticket reminder ping',
  })
   .setContent(content)
   .setAllowedMentionsRoles(roles)
   .setAllowedMentionsUsers(users);

  await ticket
   .sendMessage(payload)
   .catch((error: Error) => this.plugin.nonFatalError(error, 'sendPing'));
 };

 fireUnclaimed = async (ticket: BaseTicket) => {
  const row = await ticket.getTicket();
  if (row.state !== TicketState.opened) return;

  const t = await this.plugin.t(row.settings.guild);
  const { settings } = row;

  let roles = settings.remindRoles;
  let users = settings.remindUsers;

  if (row.tierId) {
   const tier = await this.client.db.client.ticketTier
    .findUnique({ where: { id: String(row.tierId) } })
    .catch(() => null);
   if (tier?.claimRoles.length) roles = tier.claimRoles;
  }

  if (!roles.length && !users.length) {
   roles = settings.mentionRoles;
   users = settings.mentionUsers;
  }
  if (!roles.length && !users.length) {
   roles = settings.staffRoles;
   users = settings.staffUsers;
  }

  const mentions = [...roles.map((r) => `<@&${r}>`), ...users.map((u) => `<@${u}>`)].join(' ');
  const content = `${mentions ? `${mentions} ` : ''}${t.remindUnclaimed()}`;

  await this.sendPing(ticket, content, roles, users);
  await this.reArm(ticket, RemindKind.Unclaimed, positiveSeconds(settings.remindUnclaimedEvery));
 };

 fireStale = async (ticket: BaseTicket) => {
  const row = await ticket.getTicket();
  if (row.state !== TicketState.claimed || !row.claimer) {
   await disarm.call(this.client, remindKey(RemindKind.Stale, String(row.id)));
   return;
  }

  const t = await this.plugin.t(row.settings.guild);
  const content = `<@${row.claimer}> ${t.remindStale()}`;

  await this.sendPing(ticket, content, [], [row.claimer]);
  await this.reArm(ticket, RemindKind.Stale, positiveSeconds(row.settings.remindStaleEvery));
 };

 buildInactivityWarnPayload = (
  t: Translator,
  row: TicketRow,
  closeUnix: number,
  emotes: EmoteSet,
 ): MessagePayload => {
  const container = new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `${constants.formatters.getEmote(emotes.timer)} ${t.inactivityWarn({ time: `<t:${closeUnix}:R>` })}`,
    ),
   )
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setCustomId(this.plugin.getRoute(TicketRoute.KeepOpen, row.id))
      .setLabel(t.keepOpen()),
    ),
   );

  return new MessagePayload(this.client, {
   origin: 'ticketInactivityWarn',
   reason: 'Posting ticket inactivity warning',
  })
   .setAllowedMentionsUsers([row.user])
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    new TextDisplayBuilder().setContent(`<@${row.user}>`).toJSON(),
    container.toJSON(),
   ]);
 };

 buildKeptOpenPayload = (
  t: Translator,
  userId: string,
  nextUnix: number | null,
  emotes: EmoteSet,
 ): MessagePayload => {
  const lines = [t.inactivityKeptOpen({ user: `<@${userId}>` })];
  if (nextUnix) lines.push(t.inactivityNextCheck({ time: `<t:${nextUnix}:R>` }));
  const emote = constants.formatters.getEmote(emotes.timer);

  return new MessagePayload(this.client, {
   origin: 'ticketKeepOpen',
   reason: 'Marking the inactivity warning as kept open',
  })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    new ContainerBuilder()
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emote} ${lines.join(' ')}`))
     .toJSON(),
   ]);
 };

 fireInactivityWarn = async (ticket: BaseTicket) => {
  const row = await ticket.getTicket();
  if (row.state !== TicketState.opened && row.state !== TicketState.claimed) {
   await disarm.call(this.client, remindKey(RemindKind.InactivityWarn, String(row.id)));
   return;
  }

  const closeAfter = positiveSeconds(row.settings.inactivityCloseAfter);
  if (closeAfter <= 0) {
   await disarm.call(this.client, remindKey(RemindKind.InactivityWarn, String(row.id)));
   return;
  }

  const t = await this.plugin.t(row.settings.guild);
  const closeUnix = Math.floor((Date.now() + closeAfter * 1000) / 1000);

  const api = await this.plugin.getAPI(row.settings.guild, row.settings.botToken);
  const emotes = this.client.emojis.for(api);
  const payload = this.buildInactivityWarnPayload(t, row, closeUnix, emotes);

  const posted = await this.postWarning(api, row, payload);
  const relayed = await ticket.relayToDm(payload);
  const warnings = [posted, relayed && warningRef(relayed, true)].filter(
   (ref): ref is WarningRef => !!ref,
  );

  await disarm.call(this.client, remindKey(RemindKind.InactivityWarn, String(row.id)));
  await this.armCloseAfterWarn(row, warnings);
 };

 fireInactivityClose = async (ticket: BaseTicket) => {
  const row = await ticket.getTicket();
  if (row.state === TicketState.closed || row.state === TicketState.deleted) {
   await disarm.call(this.client, remindKey(RemindKind.InactivityClose, String(row.id)));
   return;
  }

  const t = await this.plugin.t(row.settings.guild);

  await ticket
   .autoClose({ reason: t.inactivityCloseReason() })
   .catch((error: Error) => this.plugin.nonFatalError(error, 'fireInactivityClose'));
 };

 dispatchJob = async (key: string) => {
  if (!this.plugin.isEnabled()) return;

  const parsed = parseTicketKey(key);
  if (!parsed) return;

  const ticket = await getTicketClassById.call(this.client, parsed.id).catch(() => null);
  if (!ticket) return;

  switch (parsed.kind) {
   case RemindKind.Unclaimed:
    await this.fireUnclaimed(ticket);
    break;
   case RemindKind.Stale:
    await this.fireStale(ticket);
    break;
   case RemindKind.InactivityWarn:
    await this.fireInactivityWarn(ticket);
    break;
   case RemindKind.InactivityClose:
    await this.fireInactivityClose(ticket);
    break;
   default:
    break;
  }
 };

 onScheduleExpired = async (rawKey: string) => {
  const key = stripMarkerPrefix(rawKey);
  if (!key.startsWith(ticketKey)) return;

  await this.dispatchJob(key).catch((error: Error) =>
   this.plugin.nonFatalError(error, 'onScheduleExpired'),
  );
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const dataKeys = await scanDataKeys.call(this.client, `${dataKey(ticketKey)}*`);
  if (!dataKeys.length) return;

  const overdue: string[] = [];
  for (const raw of dataKeys) {
   const key = stripDataPrefix(raw);
   if (!(await isArmed.call(this.client, key))) overdue.push(key);
  }

  this.plugin.logger.debug(`[Ticketing] Reconciling ${overdue.length} overdue schedule(s)`);

  await runPool(overdue, concurrency, (key) =>
   this.dispatchJob(key).catch((error: Error) => this.plugin.nonFatalError(error, 'reconcile')),
  );
 };
}
