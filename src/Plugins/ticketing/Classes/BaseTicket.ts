import { inspect } from 'node:util';

import { RequestHandlerError } from '@ayako/api';
import { TicketState, TicketType } from '@ayako/database';
import type { Prisma, TicketSetting, TicketTier } from '@ayako/database';
import { LogLevel, type RMessage } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import {
 cloneMessageIntoContainer,
 contextMarkerButton,
} from '../../../Util/cloneMessageIntoContainer.js';
import fetchMessages from '../../../Util/fetchMessages.js';
import type TicketPlugin from '../Plugin.js';
import isUnderLimit from '../Util/isUnderLimit.js';
import { resolveStaffLabel } from '../Util/resolveStaffLabel.js';
import {
 canUserClaimTier,
 canUserReachTier,
 canUserTakeClaim,
 reachableTiers,
} from '../Util/resolveTierAccess.js';
import { countOpenForUser, matchingOpenTicket } from '../Util/ticketCounts.js';
import {
 encodeContext,
 findMessageButtonRef,
 TicketContextType,
} from '../Util/transcriptContext.js';

import BaseTicketLogger, { LogType } from './BaseTicketLogger.js';
import ChannelTicket from './ChannelTicket.js';
import { BaseTicketErrors, ChannelTicketErrors } from './Enums.js';
import { TicketRoute } from './Routes.js';

export interface MirrorRef {
 channelId: string;
 messageId: string;
 isDm: boolean;
}

export enum SurfaceState {
 Opened = 'opened',
 Claimed = 'claimed',
 Closed = 'closed',
 Left = 'left',
 Prepared = 'prepared',
 Deleted = 'deleted',
}

const surfaceAccents: Record<SurfaceState, Colors> = {
 [SurfaceState.Opened]: Colors.Success,
 [SurfaceState.Claimed]: Colors.Info,
 [SurfaceState.Closed]: Colors.Warning,
 [SurfaceState.Left]: Colors.Warning,
 [SurfaceState.Prepared]: Colors.Ephemeral,
 [SurfaceState.Deleted]: Colors.Ephemeral,
};

const surfaceContextTypes: Record<SurfaceState, TicketContextType> = {
 [SurfaceState.Opened]: TicketContextType.Created,
 [SurfaceState.Claimed]: TicketContextType.Claimed,
 [SurfaceState.Closed]: TicketContextType.Closed,
 [SurfaceState.Left]: TicketContextType.Left,
 [SurfaceState.Prepared]: TicketContextType.Created,
 [SurfaceState.Deleted]: TicketContextType.Closed,
};

const tierGlyphSlots = 4;

const tierGlyph = (rank: number, maxRank: number): string => {
 const span = Math.max(1, maxRank) + 1;
 const proportion = Math.round(((rank + 1) / span) * tierGlyphSlots);
 const filled = Math.min(tierGlyphSlots, Math.max(1, proportion));
 return `${'▰'.repeat(filled)}${'▱'.repeat(tierGlyphSlots - filled)}`;
};

export default class BaseTicket extends BaseTicketLogger {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 getTicketSettings = async (settingsId: string): Promise<TicketSetting> => {
  this.plugin.logger.logLocation(LogLevel.silly);
  const settings = await this.db.ticketSetting.findUnique({ where: { id: settingsId } });
  if (!settings) throw new Error(BaseTicketErrors.settingsNotFound);
  return settings;
 };

 isOpened = async () => {
  const ticket = await this.getTicket();
  return ticket.state === TicketState.opened;
 };

 isClosed = async () => {
  const ticket = await this.getTicket();
  return ticket.state === TicketState.closed;
 };

 isClaimed = async () => {
  const ticket = await this.getTicket();
  return ticket.state === TicketState.claimed;
 };

 async *claim({ userId }: { userId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (await this.isClosed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClosed);
  if (await this.isClaimed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClaimed);
  if (!(await this.isOpened())) throw new Error(BaseTicketErrors.claim_TicketNotOpened);

  const ticket = await this.getTicket();
  if (ticket.user === userId) throw new Error(BaseTicketErrors.claim_CreatorCannotClaim);

  const canClaim = await this.canUserClaim(userId);
  if (!canClaim) throw new Error(BaseTicketErrors.claim_UserNotStaff);

  this.plugin.logger.logLocation(LogLevel.debug);
  yield;

  const newTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.claimed, claimer: userId, claimedAt: new Date() },
   include: { settings: true },
  });

  this.dbTicket = newTicket;
  this.handleBaseLog({ type: LogType.TicketClaimed, data: { userId } });
  await this.plugin.reminders.armForState(newTicket);

  return this;
 }

 async *unclaim({ userId }: { userId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (!(await this.isClaimed())) throw new Error(BaseTicketErrors.unclaim_TicketNotClaimed);

  const canClaim = await this.canUserClaim(userId);
  if (!canClaim) throw new Error(BaseTicketErrors.unclaim_UserNotStaff);

  this.plugin.logger.logLocation(LogLevel.debug);
  yield;

  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.opened, claimer: null, claimedAt: null },
   include: { settings: true },
  });

  await this.postUnclaimMarker(userId);
  await this.plugin.reminders.armForState(this.dbTicket);

  return this;
 }

 async *take({ userId }: { userId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (!(await this.isClaimed())) throw new Error(BaseTicketErrors.take_TicketNotClaimed);

  const ticket = await this.getTicket();
  if (ticket.claimer === userId) throw new Error(BaseTicketErrors.take_AlreadyClaimer);

  const eligible = await this.canUserTakeClaim(userId);
  if (!eligible) throw new Error(BaseTicketErrors.take_NotAllowed);

  this.plugin.logger.logLocation(LogLevel.debug);
  yield;

  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.claimed, claimer: userId, claimedAt: new Date() },
   include: { settings: true },
  });

  this.handleBaseLog({ type: LogType.TicketClaimed, data: { userId } });
  await this.plugin.reminders.armForState(this.dbTicket);

  return this;
 }

 async canUserTakeClaim(userId: string) {
  const ticket = await this.getTicket();
  if (!ticket.settings.allowTakeClaim) return false;

  const tiers = await this.listTiers();
  return canUserTakeClaim(this.client, ticket, userId, tiers);
 }

 async postUnclaimMarker(actorId: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Ephemeral)
   .addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${t.unclaimedBy({ user: `<@${actorId}>` })}`),
     )
     .setButtonAccessory(
      contextMarkerButton(
       encodeContext(TicketContextType.Unclaimed, actorId, String(ticket.id)),
      ),
     ),
   );

  await this.sendMessage(
   new MessagePayload(this.client, { origin: BaseTicket.name, reason: 'Posting unclaim marker' })
    .setAllowedMentionsUsers([])
    .setAllowedMentionsRoles([])
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  ).catch((error: Error) => this.plugin.nonFatalError(error, this.postUnclaimMarker.name));
 }

 async *escalate({ userId, targetTierId }: { userId: string; targetTierId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const ticket = await this.getTicket();
  if (ticket.state === TicketState.closed || ticket.state === TicketState.deleted) {
   throw new Error(BaseTicketErrors.escalate_TicketClosed);
  }

  const tiers = await this.listTiers();
  const target = tiers.find((tier) => tier.id.toString() === targetTierId);
  if (!target) throw new Error(BaseTicketErrors.escalate_TierNotFound);

  const reachable = await canUserReachTier(this.client, ticket, userId, target, tiers);
  if (!reachable) throw new Error(BaseTicketErrors.escalate_CannotReach);

  this.plugin.logger.logLocation(LogLevel.debug);
  const { channelId }: { channelId: string } = yield;

  const data: Prisma.TicketUpdateInput = {
   state: TicketState.opened,
   claimer: null,
   claimedAt: null,
   tier: { connect: { id: target.id.toString() } },
  };
  if (channelId && channelId !== ticket.channel) data.channel = channelId;

  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data,
   include: { settings: true },
  });

  await this.postEscalationMarker(userId, target);
  await this.pingTierRoles(target);
  await this.plugin.reminders.armTierReminder(this.dbTicket, target);

  return this;
 }

 listTiers(): Promise<TicketTier[]> {
  return this.db.ticketTier
   .findMany({
    where: { settingsId: this.dbTicket?.settingsId },
    orderBy: { rank: 'asc' },
   })
   .catch(() => [] as TicketTier[]);
 }

 async getTier(tierId: string | null): Promise<TicketTier | null> {
  if (!tierId) return null;
  return this.db.ticketTier.findUnique({ where: { id: tierId } }).catch(() => null);
 }

 async reachableTiersFor(userId: string): Promise<TicketTier[]> {
  const ticket = await this.getTicket();
  const tiers = await this.listTiers();
  return reachableTiers(this.client, ticket, userId, tiers);
 }

 async postEscalationMarker(actorId: string, tier: TicketTier) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Info)
   .addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `${constants.formatters.getEmote(emotes.tools)} ${t.escalatedTo({ tier: tier.name })}`,
      ),
     )
     .setButtonAccessory(
      contextMarkerButton(
       encodeContext(TicketContextType.Escalated, actorId, String(ticket.id)),
      ),
     ),
   );

  await this.sendMessage(
   new MessagePayload(this.client, {
    origin: BaseTicket.name,
    reason: 'Posting escalation marker',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  ).catch((error: Error) => this.plugin.nonFatalError(error, this.postEscalationMarker.name));
 }

 async pingTierRoles(tier: TicketTier) {
  if (!tier.claimRoles.length) return;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const mentions = tier.claimRoles.map((r) => `<@&${r}>`).join(' ');

  await this.sendMessage(
   new MessagePayload(this.client, {
    origin: BaseTicket.name,
    reason: 'Pinging escalation tier roles',
   })
    .setContent(`${mentions} ${t.tierPing({ tier: tier.name })}`)
    .setAllowedMentionsRoles(tier.claimRoles)
    .setAllowedMentionsUsers([]),
  ).catch((error: Error) => this.plugin.nonFatalError(error, this.pingTierRoles.name));
 }

 async buildEscalationPicker(userId: string): Promise<MessagePayload | null> {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const reachable = await this.reachableTiersFor(userId);
  if (!reachable.length) return null;

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Info)
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.escalatePrompt()}**`));

  for (let index = 0; index < reachable.length; index += 5) {
   const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    reachable.slice(index, index + 5).map((tier) =>
     new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setCustomId(this.plugin.getRoute(TicketRoute.EscalateTo, ticket.id, tier.id))
      .setLabel(tier.name.slice(0, 80)),
    ),
   );
   container.addActionRowComponents(row);
  }

  return new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Building escalation tier picker',
  })
   .setComponents([container.toJSON()])
   .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
 }

 async canUserClose(userId: string) {
  const isStaff = await this.isUserStaff(userId);
  if (isStaff) return true;

  const ticket = await this.getTicket();
  if (ticket.settings.allowCreatorClose && ticket.user === userId) return true;

  return false;
 }

 async canUserClaim(userId: string) {
  const tiers = await this.listTiers();
  if (!tiers.length) return this.isUserStaff(userId);

  const ticket = await this.getTicket();
  return canUserClaimTier(this.client, ticket, userId, tiers);
 }

 async canUserDelete(userId: string) {
  return this.isUserStaff(userId);
 }

 async isUserStaff(userId: string) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const ticket = await this.getTicket();
  if (ticket.settings.staffUsers.includes(userId)) return true;

  const member = await this.client.cache.members.get(ticket.settings.guild, userId);
  if (!member) throw new Error(BaseTicketErrors.userNotFound);

  const hasStaffRole = ticket.settings.staffRoles.some((r) => member.roles.includes(r));
  return hasStaffRole;
 }

 async *close({ userId, reason }: { userId: string; reason?: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (await this.isClosed()) throw new Error(BaseTicketErrors.close_TicketAlreadyClosed);

  const canClose = await this.canUserClose(userId);
  if (!canClose) throw new Error(BaseTicketErrors.close_UserNotStaff);

  this.plugin.logger.logLocation(LogLevel.debug);
  yield;

  await this.markClosed(userId, reason);

  return this;
 }

 async markClosed(
  userId: string,
  reason?: string,
 ): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> {
  const newTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.closed },
   include: { settings: true },
  });

  this.dbTicket = newTicket;
  this.handleBaseLog({ type: LogType.TicketClosed, data: { userId, reason } });
  await this.plugin.reminders.armForState(newTicket);

  return newTicket;
 }

 async autoClose({ reason }: { reason?: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (await this.isClosed()) return this;

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  await this.markClosed(api.botId, reason);

  await this.postAutoCloseNotice(api.botId, reason);
  await this.refreshSurface();

  return this;
 }

 async postAutoCloseNotice(actorId: string, reason?: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Warning)
   .addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `${constants.formatters.getEmote(emotes.lock)} ${t.hasClosedThreadInactive()}`,
      ),
     )
     .setButtonAccessory(
      contextMarkerButton(encodeContext(TicketContextType.Closed, actorId, String(ticket.id))),
     ),
   );

  if (reason) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${t.base.t.Reason()}**\n${reason}`),
   );
  }

  await this.sendMessage(
   new MessagePayload(this.client, {
    origin: BaseTicket.name,
    reason: 'Posting inactivity auto-close notice',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  ).catch((error: Error) => this.plugin.nonFatalError(error, this.postAutoCloseNotice.name));
 }

 async *delete({ userId }: { userId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const ticket = await this.getTicket();
  if (!ticket) throw new Error(BaseTicketErrors.delete_TicketNotFound);
  if (ticket.state !== TicketState.closed) throw new Error(BaseTicketErrors.delete_TicketNotClosed);

  const canDelete = await this.canUserDelete(userId);
  if (!canDelete) throw new Error(BaseTicketErrors.delete_OnlyStaffCanDelete);

  this.plugin.logger.logLocation(LogLevel.debug);
  await this.markDeleted();

  yield;

  this.handleBaseLog({ type: LogType.TicketDeleted, data: { userId } });

  return true;
 }

 async markDeleted() {
  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.deleted },
   include: { settings: true },
  });

  await this.plugin.reminders.armForState(this.dbTicket);
 }

 async *create(
  dbOpts: { settingsId: string; userId: string },
  createOpts: { userId: string; roleIds: string[] },
 ) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const exists = await this.getTicket().catch(() => null);
  if (exists) throw new Error(BaseTicketErrors.create_TicketExists);

  await this.enforceCreateLimits(dbOpts.settingsId, dbOpts.userId);

  const preparedEntry = await this.prepareEntry(dbOpts.userId, dbOpts.settingsId);
  this.dbTicket = preparedEntry;
  this.plugin.logger.logLocation(LogLevel.debug);

  const settings = await this.getTicketSettings(dbOpts.settingsId);

  if (settings.denyUsers.includes(createOpts.userId)) {
   throw new Error(BaseTicketErrors.create_UserDenied);
  }
  if (settings.denyRoles.some((r) => createOpts.roleIds.includes(r))) {
   throw new Error(BaseTicketErrors.create_RoleDenied);
  }

  const { channelId }: { channelId: string } = yield;

  try {
   await this.createDbEntry({ ...dbOpts, channelId });

   this.plugin.logger.logLocation(LogLevel.debug);
   this.handleBaseLog({ type: LogType.TicketCreated, data: { userId: dbOpts.userId } });

   return this;
  } finally {
   await this.deletePreparedEntry();
  }
 }

 async deletePreparedEntry() {
  const ticket = await this.getTicket();
  if (ticket.state !== TicketState.prepared) {
   this.plugin.logger.logLocation(LogLevel.silly);
   return;
  }

  this.plugin.logger.logLocation(LogLevel.debug);
  this.db.ticket.delete({ where: { id: ticket.id } }).then();
 }

 async enforceCreateLimits(settingsId: string, userId: string) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const settings = await this.getTicketSettings(settingsId);

  const kind = await isUnderLimit.call(this.client, settings, userId);
  if (!kind.ok) {
   const routeId = await matchingOpenTicket.call(this.client, userId, settingsId);
   throw new Error(BaseTicketErrors.create_LimitKindReached, {
    cause: { count: settings.ticketLimitKind, ticketId: routeId || kind.ticketId },
   });
  }

  if (settings.ticketLimitTotal > 0) {
   const total = await countOpenForUser.call(this.client, settings.guild, userId);
   if (total >= settings.ticketLimitTotal) {
    const routeId = await matchingOpenTicket.call(this.client, userId, settingsId);
    throw new Error(BaseTicketErrors.create_LimitTotalReached, {
     cause: { count: settings.ticketLimitTotal, ticketId: routeId },
    });
   }
  }
 }

 async prepareEntry(
  userId: string,
  settingsId: string,
 ): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> {
  this.id = String(Date.now());
  this.plugin.logger.logLocation(LogLevel.silly);

  return this.db.ticket.create({
   data: {
    channel: `temp-${Date.now()}`,
    id: this.id,
    user: userId,
    settings: { connect: { id: settingsId } },
    state: TicketState.prepared,
   },
   include: { settings: true },
  });
 }

 async createDbEntry(dbOpts: { settingsId: string; userId: string; channelId: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const settings = await this.db.ticketSetting.findUnique({
   where: { id: dbOpts.settingsId },
   // eslint-disable-next-line @typescript-eslint/naming-convention
   include: { Ticket: { where: { user: dbOpts.userId } } },
  });
  if (!settings) throw new Error(BaseTicketErrors.create_SettingsNotFound);
  if (!settings.channel) throw new Error(BaseTicketErrors.create_SettingsChannelNotFound);
  if (!settings.active) throw new Error(BaseTicketErrors.create_SettingsInactive);

  const preparedTicket = await this.getTicket();

  this.dbTicket = await this.db.ticket.update({
   data: { channel: dbOpts.channelId, user: dbOpts.userId, state: TicketState.opened },
   where: { id: preparedTicket.id },
   include: { settings: true },
  });

  this.plugin.logger.logLocation(LogLevel.debug);
  return this.dbTicket;
 }

 async getInitPayload(mentionUser: boolean, staffThreadId?: string | null) {
  return this.buildStatusSurface(mentionUser, staffThreadId);
 }

 resolveSurfaceState(ticket: Awaited<ReturnType<BaseTicket['getTicket']>>): SurfaceState {
  if (ticket.state === TicketState.deleted) return SurfaceState.Deleted;
  if (ticket.state === TicketState.prepared) return SurfaceState.Prepared;
  if (ticket.state === TicketState.closed) return SurfaceState.Closed;
  if (ticket.starterDm && !ticket.dm) return SurfaceState.Left;
  if (ticket.state === TicketState.claimed) return SurfaceState.Claimed;
  return SurfaceState.Opened;
 }

 stateGlyph(state: SurfaceState): string {
  switch (state) {
   case SurfaceState.Claimed:
    return constants.formatters.getEmote(emotes.tools) || '';
   case SurfaceState.Closed:
    return constants.formatters.getEmote(emotes.lock) || '';
   case SurfaceState.Left:
    return constants.formatters.getEmote(emotes.crossWithBackground) || '';
   case SurfaceState.Prepared:
   case SurfaceState.Deleted:
    return constants.formatters.getEmote(emotes.disabled) || '';
   default:
    return constants.formatters.getEmote(emotes.enabled) || '';
  }
 }

 stateLabel(state: SurfaceState, t: Awaited<ReturnType<TicketPlugin['t']>>): string {
  switch (state) {
   case SurfaceState.Claimed:
    return t.stateClaimed();
   case SurfaceState.Closed:
    return t.stateClosed();
   case SurfaceState.Left:
    return t.stateLeft();
   default:
    return t.stateOpened();
  }
 }

 tierLine(
  ticket: Awaited<ReturnType<BaseTicket['getTicket']>>,
  tiers: TicketTier[],
  t: Awaited<ReturnType<TicketPlugin['t']>>,
 ): string {
  if (!tiers.length) return `${'▱'.repeat(tierGlyphSlots)} ${t.tierNone()}`;

  const current = tiers.find((tier) => tier.id.toString() === ticket.tierId?.toString());
  if (!current) return `${'▱'.repeat(tierGlyphSlots)} ${t.tierNone()}`;

  const maxRank = tiers.reduce((max, tier) => Math.max(max, tier.rank), 0);
  return `${tierGlyph(current.rank, maxRank)} ${t.tierLabel({ tier: current.name })}`;
 }

 formatRelative(value: Date | Prisma.Decimal | string | null): string | null {
  if (value === null) return null;
  const ms = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return `<t:${Math.floor(ms / 1000)}:R>`;
 }

 async buildStatusSurface(mentionUser: boolean, staffThreadId?: string | null) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const state = this.resolveSurfaceState(ticket);

  const components: APIMessageTopLevelComponent[] = [];

  const mentionLine = [
   mentionUser ? `<@${ticket.user}>` : '',
   ticket.settings.mentionRoles.map((r) => `<@&${r}>`).join(' '),
   ticket.settings.mentionUsers.map((u) => `<@${u}>`).join(' '),
  ]
   .filter((s) => s.length)
   .join('\n');
  if (mentionLine) components.push(new TextDisplayBuilder().setContent(mentionLine).toJSON());

  const container = new ContainerBuilder().setAccentColor(surfaceAccents[state]);

  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `-# ${constants.formatters.getEmote(emotes.ticket)} ${this.kindLabel(ticket.settings.type, t)} • #${ticket.id}`,
     ),
    )
    .setButtonAccessory(this.buildSurfaceContextButton(ticket, state)),
  );

  const claimerLine = `${t.claimedBy()}: ${ticket.claimer ? `<@${ticket.claimer}>` : '-'}`;
  const lastReply = this.formatRelative(ticket.lastMessageAt);
  const remind = this.formatRelative(ticket.remindAt);
  const tiers = await this.listTiers();
  const tierLine = this.tierLine(ticket, tiers, t);

  const bodyLines = [
   `${this.stateGlyph(state)} ${this.stateLabel(state, t)}`,
   `${t.base.t.User()}: <@${ticket.user}>`,
   claimerLine,
   tierLine,
   ...(lastReply ? [`${t.lastReply()}: ${lastReply}`] : []),
   ...(remind ? [`${t.inactivityIn()}: ${remind}`] : []),
  ];
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines.join('\n')));

  if (staffThreadId) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `-# ${t.staffThreadMention({ channel: `<#${staffThreadId}>` })}`,
    ),
   );
  }

  if (ticket.settings.sendMessagePrefixes.length) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `**${t.replyWith()}**\n${ticket.settings.sendMessagePrefixes.map((p) => `\`${p}\``).join(', ')}`,
    ),
   );
  }

  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    this.buildSurfaceActionRow(ticket, state, t, tiers.length > 0),
   ),
  );

  components.push(container.toJSON());

  return new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Creating ticket status surface',
  })
   .setAllowedMentionsUsers([
    ...ticket.settings.mentionUsers,
    ...(mentionUser ? [ticket.user] : []),
   ])
   .setAllowedMentionsRoles(ticket.settings.mentionRoles)
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(components);
 }

 kindLabel(type: TicketSetting['type'], t: Awaited<ReturnType<TicketPlugin['t']>>): string {
  switch (type) {
   case TicketType.Thread:
    return t.base.t.Thread();
   case TicketType.dmToChannel:
    return t.settings.options.dmToChannel();
   case TicketType.dmToThread:
    return t.settings.options.dmToThread();
   case TicketType.Channel:
    return t.base.t.Channel();
  }
 }

 buildSurfaceActionRow(
  ticket: Awaited<ReturnType<BaseTicket['getTicket']>>,
  state: SurfaceState,
  t: Awaited<ReturnType<TicketPlugin['t']>>,
  hasTiers: boolean,
 ) {
  const buttons: ButtonBuilder[] = [
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.plugin.getRoute(TicketRoute.UserInfo, ticket.user))
    .setLabel(t.userInfo()),
  ];

  if (state === SurfaceState.Closed) {
   buttons.push(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Danger)
     .setCustomId(this.plugin.getRoute(TicketRoute.Delete, ticket.id))
     .setLabel(t.base.t.Delete()),
   );
   return buttons;
  }

  if (state === SurfaceState.Left) return buttons;

  if (state === SurfaceState.Claimed) {
   buttons.push(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.plugin.getRoute(TicketRoute.Unclaim, ticket.id))
     .setLabel(t.unclaimTicket()),
   );
   if (ticket.settings.allowTakeClaim) {
    buttons.push(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setCustomId(this.plugin.getRoute(TicketRoute.Take, ticket.id))
      .setLabel(t.takeClaim()),
    );
   }
  } else {
   buttons.push(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Success)
     .setCustomId(this.plugin.getRoute(TicketRoute.Claim, ticket.id))
     .setLabel(t.claimTicket()),
   );
  }

  if (hasTiers) {
   buttons.push(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.plugin.getRoute(TicketRoute.Escalate, ticket.id))
     .setLabel(t.escalate()),
   );
  }

  buttons.push(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(this.plugin.getRoute(TicketRoute.Close, ticket.id))
    .setLabel(t.closeTicket()),
  );

  return buttons;
 }

 buildSurfaceContextButton(
  ticket: Awaited<ReturnType<BaseTicket['getTicket']>>,
  state: SurfaceState,
 ) {
  return contextMarkerButton(
   encodeContext(surfaceContextTypes[state], ticket.claimer || '0', String(ticket.id)),
  );
 }

 async refreshSurface() {
  const ticket = await this.getTicket();
  if (!ticket.surfaceMessage) return;

  this.plugin.logger.logLocation(LogLevel.debug);

  const staffThreadId = await this.getStaffThreadId();
  const payload = await this.buildStatusSurface(false, staffThreadId);

  const modify = await payload.edit(ticket.channel, ticket.surfaceMessage);
  if (modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(modify, this.refreshSurface.name);
  }
 }

 async repostSurface() {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  const payload = await this.getInitPayload(true);
  const message = await this.sendMessage(payload).catch((error: Error) => {
   this.plugin.nonFatalError(error, this.repostSurface.name);
   return null;
  });
  if (!message) return;

  const pin = await api.channels.pinMessage(ticket.channel, message.id, {
   origin: BaseTicket.name,
   reason: 'Pinning escalated ticket surface',
  });
  if (pin instanceof RequestHandlerError) this.plugin.nonFatalError(pin, this.repostSurface.name);

  await this.setSurfaceMessage(message.id);
 }

 async setSurfaceMessage(
  messageId: string,
 ): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> {
  this.plugin.logger.logLocation(LogLevel.silly);
  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { surfaceMessage: messageId },
   include: { settings: true },
  });
  return this.dbTicket;
 }

 async setLastMessage(): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> {
  this.plugin.logger.logLocation(LogLevel.silly);
  this.dbTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { lastMessageAt: new Date() },
   include: { settings: true },
  });

  await this.plugin.reminders.resetActivityTimers(this.dbTicket);

  return this.dbTicket;
 }

 async resetActivity(): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> {
  return this.setLastMessage();
 }

 async sendMessage(payload: MessagePayload) {
  const ticket = await this.getTicket();
  this.plugin.logger.logLocation(LogLevel.debug);

  const msg = await payload
   .setSendTo([{ channel: ticket.channel, guildId: ticket.settings.guild }])
   .send()
   .then((m) => m[0]);

  if (!msg || msg instanceof RequestHandlerError) {
   this.plugin.logger.logLocation(LogLevel.error);

   throw new Error(ChannelTicketErrors.cantSendMessage, { cause: inspect(msg?.cause) });
  }

  return msg;
 }

 async startsWithPrefix(content: string) {
  const ticket = await this.getTicket();
  return ticket.settings.sendMessagePrefixes.some((p) =>
   content.toLowerCase().startsWith(p.toLowerCase()),
  );
 }

 async staffReply(msg: RMessage) {
  return this.messageSent(msg, true);
 }

 async forwardToTicketChannel(msg: RMessage) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const user = await this.getUser(msg.author_id);
  const name = user?.username || t.base.t.unknownUser();

  const container = this.buildMirrorContainer(
   msg,
   `${constants.formatters.getEmote(emotes.Member)} ${name}`,
   await this.forwardLabels(),
  );

  await this.sendMessage(
   new MessagePayload(this.client, {
    origin: ChannelTicket.name,
    reason: 'Logging sent message',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  ).catch((error: Error) => this.plugin.nonFatalError(error, this.forwardToTicketChannel.name));
 }

 buildMirrorContainer(
  msg: RMessage,
  authorName: string,
  forwardLabels?: { forwardedFromLabel: string; forwardUnavailableLabel: string },
 ) {
  const container = new ContainerBuilder();
  cloneMessageIntoContainer.call(container, msg, {
   authorName,
   context: encodeContext(TicketContextType.Forwarded, msg.author_id, msg.id),
   ...forwardLabels,
  });
  return container;
 }

 async forwardLabels() {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  return {
   forwardedFromLabel: t.forwardedFrom(),
   forwardUnavailableLabel: t.forwardSourceUnavailable(),
  };
 }

 async findMirror(originalId: string): Promise<MirrorRef | null> {
  const ticket = await this.getTicket();

  const channelHit = await this.scanForMirror(
   ticket.channel,
   ticket.settings.guild,
   false,
   originalId,
  );
  if (channelHit) return { channelId: ticket.channel, messageId: channelHit, isDm: false };

  if (ticket.dm) {
   const dmHit = await this.scanForMirror(
    ticket.dm,
    ticket.settings.guild,
    true,
    originalId,
    ticket.starterDm,
   );
   if (dmHit) return { channelId: ticket.dm, messageId: dmHit, isDm: true };
  }

  return null;
 }

 async scanForMirror(
  channelId: string,
  guildId: string,
  isDm: boolean,
  originalId: string,
  after?: string | null,
 ): Promise<string | null> {
  const matches = (m: { components?: unknown }) => findMessageButtonRef(m.components, originalId);

  const cached = await this.client.cache.messages.getAll(isDm ? '@me' : guildId, channelId);
  const cachedHit = cached.find(matches);
  if (cachedHit) return cachedHit.id;

  const fetched = await fetchMessages.call(
   this.client,
   channelId,
   guildId,
   { amount: 500, isDm, after: after || undefined, abortWhen: matches },
   { origin: BaseTicket.name, reason: 'Locating mirrored message' },
  );
  const hit = fetched.find(matches);
  return hit?.id || null;
 }

 async editMirror(mirror: MirrorRef, msg: RMessage) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  let authorName: string;
  if (mirror.isDm) {
   authorName = await resolveStaffLabel.call(
    this.client,
    ticket.settings.guild,
    msg.author_id,
    `${emotes.tools.name} | ${t.SupportTeam()}`,
   );
  } else {
   const user = await this.getUser(msg.author_id);
   const name = user?.username || t.base.t.unknownUser();
   authorName = `${constants.formatters.getEmote(emotes.Member)} ${name}`;
  }

  const payload = new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Editing mirrored message',
  })
   .setComponents([this.buildMirrorContainer(msg, authorName, await this.forwardLabels()).toJSON()])
   .setFlags(MessageFlags.IsComponentsV2);

  if (mirror.isDm) await payload.editDM(mirror.channelId, mirror.messageId);
  else await payload.edit(mirror.channelId, mirror.messageId);
 }

 async deleteMirror(mirror: MirrorRef) {
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const debugInfo = { origin: BaseTicket.name, reason: 'Deleting mirrored message' };
  const { channelId, messageId } = mirror;

  if (mirror.isDm) await api.channels.deleteDirectMessage(channelId, messageId, debugInfo);
  else await api.channels.deleteMessage(channelId, messageId, debugInfo);
 }

 async propagateEdit(msg: RMessage) {
  const mirror = await this.findMirror(msg.id);
  if (mirror) await this.editMirror(mirror, msg);
  this.messageEdited(msg, false, !!mirror);
 }

 async propagateDelete(originalId: string) {
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const times = await this.client.cache.messages.getTimes(originalId);
  const cached = times.length
   ? await this.client.cache.messages.getAt(Math.max(...times), originalId)
   : null;

  if (cached && cached.author_id === api.botId) return;

  const mirror = await this.findMirror(originalId);
  if (mirror) await this.deleteMirror(mirror);

  this.messageDeleted(cached, false, !!mirror);
 }

 async react(msg: RMessage) {
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const opts = { origin: BaseTicket.name, reason: 'Marking message forwarded to the user' };
  const main = constants.formatters.getEmoteIdentifier(emotes.tickWithBackground);

  if (msg.channel_id === ticket.dm) {
   const res = await api.channels.addDirectMessageReaction(msg.channel_id, msg.id, main, opts);
   if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, this.react.name);
   return;
  }

  const alt = constants.formatters.getEmoteIdentifier({ name: '✅' });
  const res = await api.channels.addMessageReaction(
   ticket.settings.guild,
   msg.channel_id,
   msg.id,
   { main, alt },
   opts,
  );
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, this.react.name);
 }

 async unreact(msg: RMessage) {
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const opts = { origin: BaseTicket.name, reason: 'Removing forwarded marker from message' };
  const main = constants.formatters.getEmoteIdentifier(emotes.tickWithBackground);

  if (msg.channel_id === ticket.dm) {
   const res = await api.channels.deleteDirectMessageReaction(msg.channel_id, msg.id, main, opts);
   if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, this.unreact.name);
   return;
  }

  const alt = constants.formatters.getEmoteIdentifier({ name: '✅' });
  for (const emoji of [main, alt]) {
   const res = await api.channels.deleteMessageReaction(
    ticket.settings.guild,
    msg.channel_id,
    msg.id,
    emoji,
    opts,
   );
   if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, this.unreact.name);
  }
 }
}
