import type { API } from '@ayako/api';
import { RequestHandlerError } from '@ayako/api';
import type { TicketTier } from '@ayako/database';
import { TicketPlacementMode } from '@ayako/database';
import { LogLevel, type RChannel, type RMessage, type RThread } from '@ayako/utility';
import {
 ChannelType,
 MessageFlags,
 OverwriteType,
 PermissionFlagsBits,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import getUser from '../../../Util/getUser.js';
import type TicketPlugin from '../Plugin.js';
import { resolveStaffLabel } from '../Util/resolveStaffLabel.js';

import BaseTicket from './BaseTicket.js';
import { ChannelTicketErrors } from './Enums.js';

export default class ChannelTicket extends BaseTicket {
 static threadTypes = [
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
 ];

 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
  this.plugin = plugin;
 }

 // eslint-disable-next-line require-yield
 async *delete(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superDel = super.delete(data);
  await superDel.next();

  const deletePayload = await this.getDeletePayload();
  await this.replyMessage(data.cmd, deletePayload, ChannelTicketErrors.delete_CantUpdateMessage);

  await this.archiveStaffThread();
  await this.deleteChannel();
  await superDel.next();

  return true;
 }

 async deleteChannel() {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const res = await api.channels.delete(ticket.channel, {
   origin: ChannelTicket.name,
   reason: 'Ticket deleted',
  });

  if (res && res instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.delete_CantDeleteChannel, { cause: res });
  }

  return res;
 }

 async replyMessage(
  cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
  payload: MessagePayload,
  errorCode: (typeof ChannelTicketErrors)[keyof typeof ChannelTicketErrors],
 ) {
  const modify = await payload.reply(cmd);

  if (modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(new Error(errorCode, { cause: modify }), this.replyMessage.name);
  }

  return modify;
 }

 async getDeletePayload() {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: '"Prepping delete" message',
  })
   .setEmbeds([])
   .setComponents([])
   .setContent(t.deleting());
 }

 // eslint-disable-next-line require-yield
 async *close(data: { userId: string; cmd: APIModalSubmitInteraction; reason?: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const superClose = super.close({ userId: data.userId, reason: data.reason });
  await superClose.next();

  const ticket = await this.getTicket();
  const channel = await this.getChannel(ticket.channel);

  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  await this.closeChannel(api, channel);
  await this.revokeChannelAccess(api, channel);
  await this.lockStaffThread();
  await this.applyLifecycleTags(ticket.settings.closeTags);

  await superClose.next();

  await this.refreshSurface();
  await this.ackEphemeral(data.cmd, (t) => t.hasClosedThread());

  return this;
 }

 async autoClose({ reason }: { reason?: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  if (await this.isClosed()) return this;

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  await this.markClosed(api.botId, reason);

  const channel = await this.getChannel(ticket.channel);

  await this.closeChannel(api, channel);
  await this.revokeChannelAccess(api, channel);
  await this.lockStaffThread();
  await this.applyLifecycleTags(ticket.settings.closeTags);

  await this.postAutoCloseNotice(api.botId, reason);
  await this.refreshSurface();

  return this;
 }

 async revokeChannelAccess(api: API, channel: RChannel | RThread) {
  if (!this.isChannel(channel)) throw new Error(ChannelTicketErrors.badChannelSupplied);

  this.plugin.logger.logLocation(LogLevel.debug);
  const modify = await Promise.all(
   channel.permission_overwrites
    ?.filter((o) => o.type === OverwriteType.Member)
    .map((o) =>
     api.channels.deletePermissionOverwrite(channel.id, o.id, {
      origin: ChannelTicket.name,
      reason: 'Removing user permissions on ticket close',
     }),
    ) || [],
  );

  const errors = modify.filter((m) => m instanceof RequestHandlerError);
  errors.forEach((error) => this.plugin.nonFatalError(error, this.revokeChannelAccess.name));

  return modify;
 }

 isChannel(channel: RChannel | RThread): channel is RChannel {
  return !ChannelTicket.threadTypes.includes(channel.type);
 }

 async closeChannel(api: API, _channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const archiveCategory = await this.getChannel(ticket.settings.archiveCategory || '');
  if (!this.isChannel(archiveCategory)) throw new Error(ChannelTicketErrors.badChannelSupplied);

  const t = await this.plugin.t(ticket.settings.guild);

  const modify = await api.channels.edit(
   ticket.channel,
   {
    name: await this.creatorChannelName(t.closed()),
    parent_id: archiveCategory?.id || undefined,
    permission_overwrites:
     archiveCategory?.permission_overwrites?.map((o) => ({
      id: o.id,
      type: o.type,
      allow: String(o.allow),
      deny: String(o.deny),
     })) || undefined,
   },
   { origin: ChannelTicket.name, reason: 'Closing ticket' },
  );

  if (!modify || modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(
    modify || new Error(ChannelTicketErrors.close_CantEditChannel, { cause: modify }),
    this.closeChannel.name,
   );
  }

  return modify;
 }

 // eslint-disable-next-line require-yield
 async *claim(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superClaim = super.claim({ userId: data.userId });
  await superClaim.next();
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  const channel = await this.getChannel(ticket.channel);
  const user = await getUser
   .call(this.client, data.userId)
   .then((r) => (r instanceof RequestHandlerError ? null : r));

  await this.claimChannel(api, channel.id, ticket.settings.guild);
  await this.addClaimerToStaffThread(data.userId);
  await this.applyLifecycleTags(
   ticket.settings.claimTags,
   ticket.settings.tagClaimer ? user?.username || null : null,
  );

  await superClaim.next();

  await this.refreshSurface();

  const claimerLabel = await resolveStaffLabel.call(
   this.client,
   ticket.settings.guild,
   data.userId,
   { name: `<@${data.userId}>`, emote: emotes.ticket },
  );
  await this.ackEphemeral(data.cmd, (t) => t.claimedByLabel({ label: claimerLabel.name }));

  return this;
 }

 async ackEphemeral(
  cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
  content: (t: Awaited<ReturnType<TicketPlugin['t']>>) => string,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const payload = new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Acknowledging ticket lifecycle interaction',
  })
   .setAllowedMentionsUsers([])
   .setAllowedMentionsRoles([])
   .setContent(content(t))
   .setFlags(MessageFlags.Ephemeral);

  await this.replyMessage(cmd, payload, ChannelTicketErrors.cantSendMessage);
 }

 // eslint-disable-next-line require-yield
 async *unclaim(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superUnclaim = super.unclaim({ userId: data.userId });
  await superUnclaim.next();
  await superUnclaim.next();

  await this.refreshSurface();
  await this.ackEphemeral(data.cmd, (t) => t.unclaimTicket());

  return this;
 }

 // eslint-disable-next-line require-yield
 async *take(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superTake = super.take({ userId: data.userId });
  await superTake.next();
  await superTake.next();

  await this.addClaimerToStaffThread(data.userId);
  await this.refreshSurface();

  const claimerLabel = await resolveStaffLabel.call(
   this.client,
   (await this.getTicket()).settings.guild,
   data.userId,
   { name: `<@${data.userId}>`, emote: emotes.ticket },
  );
  await this.ackEphemeral(data.cmd, (t) => t.claimedByLabel({ label: claimerLabel.name }));

  return this;
 }

 // eslint-disable-next-line require-yield
 async *escalate(data: {
  userId: string;
  cmd: APIMessageComponentInteraction;
  targetTierId: string;
 }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superEscalate = super.escalate({ userId: data.userId, targetTierId: data.targetTierId });
  await superEscalate.next();

  const ticket = await this.getTicket();
  const target = await this.getTier(data.targetTierId);

  if (ticket.settings.placementMode === TicketPlacementMode.UnifiedForum) {
   await this.retagForTier(target);
   await superEscalate.next({ channelId: ticket.channel });
  } else {
   await this.moveToTierSpace(target);
   await superEscalate.next({ channelId: ticket.channel });
  }

  await this.refreshSurface();
  await this.ackEphemeral(data.cmd, (t) => t.escalatedTo({ tier: target?.name || '' }));

  return this;
 }

 async moveToTierSpace(target: TicketTier | null) {
  if (!target?.category) return;
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const category = await this.getChannel(target.category).catch(() => null);

  const modify = await api.channels.edit(
   ticket.channel,
   {
    parent_id: target.category,
    permission_overwrites:
     category && 'permission_overwrites' in category
      ? category.permission_overwrites?.map((o) => ({
         id: o.id,
         type: o.type,
         allow: String(o.allow),
         deny: String(o.deny),
        }))
      : undefined,
   },
   { origin: ChannelTicket.name, reason: 'Moving ticket to escalation tier category' },
  );

  if (modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(modify, this.moveToTierSpace.name);
  }
 }

 async retagForTier(target: TicketTier | null) {
  if (!target) return;
  const ticket = await this.getTicket();
  const forum = await this.client.cache.channels.get(ticket.settings.forumChannel || '');
  if (!this.isForumChannel(forum)) return;

  await this.retagForumPost(forum, ticket.channel, [target.name], []);
 }

 async getChannel(id: string): Promise<RChannel | RThread> {
  const channel = await this.client.cache.channels.get(id);
  if (!channel) throw new Error(ChannelTicketErrors.channelNotFound);

  return channel;
 }

 async creatorChannelName(statusPrefix?: string, username?: string): Promise<string> {
  const ticket = await this.getTicket();

  let name = username;
  if (name === undefined) {
   const creator = await getUser
    .call(this.client, ticket.user)
    .then((u) => (u instanceof RequestHandlerError ? null : u));
   name = creator?.username;
  }

  const base = name ? `${name} ${ticket.user}` : ticket.user;
  const status = statusPrefix ?? (await this.plugin.t(ticket.settings.guild)).opened();
  return `[${status}] ${base}`.slice(0, 100);
 }

 async claimChannel(api: API, channelId: string, guildId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);
  const t = await this.plugin.t(guildId);

  const modify = await api.channels.edit(
   channelId,
   { name: await this.creatorChannelName(t.claimed()) },
   { origin: ChannelTicket.name, reason: 'Ticket claimed' },
  );

  if (!modify || modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.claim_CantEditChannel, { cause: modify });
  }

  return modify;
 }

 // eslint-disable-next-line require-yield
 async *create(
  dbOpts: { settingsId: string; userId: string },
  createOpts: {
   cmd: APIMessageComponentInteraction;
   userId: string;
   roleIds: string[];
   username: string;
  },
 ) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superCreate = super.create(dbOpts, createOpts);
  await superCreate.next();

  try {
   const ticketSettings = await this.getTicketSettings(dbOpts.settingsId);
   const api = await this.plugin.getAPI(ticketSettings.guild, ticketSettings.botToken);
   const channel = await this.createChannel(api, createOpts.username, dbOpts.settingsId);

   await superCreate.next({ channelId: channel.id });

   await this.grantChannelAccess(api, channel.id, createOpts.userId);

   const surfaceId = await this.postInitialSurface(api, channel);

   await this.setSurfaceMessage(surfaceId);
   await this.plugin.reminders.armForState(await this.getTicket());

   await this.createStaffThread(surfaceId);

   const replyPayload = await this.getCreateReplyPayload(channel.id, surfaceId);
   await this.replyMessage(
    createOpts.cmd,
    replyPayload,
    ChannelTicketErrors.create_CantReplyMessage,
   );

   return this;
  } finally {
   this.deletePreparedEntry();
  }
 }

 async postInitialSurface(api: API, channel: RChannel | RThread): Promise<string> {
  const initPayload = await this.getInitPayload(true);
  const initMessage = await this.sendMessage(initPayload);

  const pin = await api.channels.pinMessage(channel.id, initMessage.id, {
   origin: ChannelTicket.name,
   reason: 'Pinning initial ticket message',
  });
  if (pin instanceof RequestHandlerError) {
   this.plugin.nonFatalError(pin, this.postInitialSurface.name);
  }

  return initMessage.id;
 }

 async getCreateReplyPayload(channelId: string, messageId: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: this.plugin.name,
   reason: 'Replying to ticket creation interaction',
  })
   .setContent(`${t.ticketed()} => ${await this.getMessageUrl(channelId, messageId)}`)
   .setFlags(MessageFlags.Ephemeral);
 }

 async getMessageUrl(channelId: string, messageId: string) {
  const ticket = await this.getTicket();
  return constants.formatters.msgURL(ticket.settings.guild, channelId, messageId);
 }

 async createChannel(api: API, username: string, settingsId: string): Promise<RChannel | RThread> {
  this.plugin.logger.logLocation(LogLevel.debug);
  const ticketSettings = await this.getTicketSettings(settingsId);
  const name = await this.creatorChannelName(undefined, username);

  const channel = await api.guilds.createChannel(
   ticketSettings.guild,
   {
    name,
    type: ChannelType.GuildText,
    parent_id: ticketSettings.category,
   },
   { origin: ChannelTicket.name, reason: 'Creating channel for ticket' },
  );

  if (!channel || channel instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.create_CantCreateChannel, { cause: channel });
  }

  return channel;
 }

 async grantChannelAccess(api: API, channelId: string, userId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);
  const modify = await api.channels.editPermissionOverwrite(
   channelId,
   userId,
   {
    type: OverwriteType.Member,
    allow: String(
     PermissionFlagsBits.ViewChannel |
      PermissionFlagsBits.SendMessages |
      PermissionFlagsBits.AttachFiles |
      PermissionFlagsBits.EmbedLinks,
    ),
   },
   {
    origin: ChannelTicket.name,
    reason: 'Setting permissions for ticket channel',
   },
  );

  if (modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.create_CantUpdatePermissions, { cause: modify });
  }

  return modify;
 }

 async messageSent(msg: RMessage, internal: boolean = false) {
  const ticket = await this.getTicket();

  if (internal) return super.messageSent(msg, true);
  if (msg.channel_id === ticket.channel) return super.messageSent(msg);

  await this.forwardToTicketChannel(msg);
  await this.setLastMessage();

  return super.messageSent(msg);
 }

 async staffThreadParentId(): Promise<string | null> {
  const ticket = await this.getTicket();
  if (!ticket.settings.staffThreads) return null;
  return ticket.channel;
 }

 staffThreadType(): ChannelType.PublicThread | ChannelType.PrivateThread {
  return ChannelType.PrivateThread;
 }

 async findStaffThread(): Promise<RThread | null> {
  const parentId = await this.staffThreadParentId();
  if (!parentId) return null;

  const ticket = await this.getTicket();
  const threads = await this.client.cache.threads.getAll(ticket.settings.guild, parentId);
  return threads?.find((th) => th.name === `staff-${this.id}`) || null;
 }

 async getStaffThreadId(): Promise<string | null> {
  return (await this.findStaffThread())?.id || null;
 }

 async getStaffIntroPayload() {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Creating staff thread intro message',
  }).setEmbeds([
   { author: { name: t.ticketSystem() }, description: t.staffIntro(), color: Colors.Ephemeral },
  ]);
 }

 async createStaffThread(initMessageId: string): Promise<void> {
  const parentId = await this.staffThreadParentId();
  if (!parentId) return;

  this.plugin.logger.logLocation(LogLevel.debug);

  const intro = await this.getStaffIntroPayload();
  const thread = await this.createNamedThread(
   parentId,
   `staff-${this.id}`,
   this.staffThreadType(),
   intro,
  );
  if (!thread) return;

  await this.editInitWithStaffMention(initMessageId, thread.id);
 }

 async editInitWithStaffMention(initMessageId: string, staffThreadId: string) {
  const ticket = await this.getTicket();

  const payload = await this.getInitPayload(true, staffThreadId);
  const modify = await payload.edit(ticket.channel, initMessageId);
  if (modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(modify, this.editInitWithStaffMention.name);
  }
 }

 async addClaimerToStaffThread(userId: string) {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const res = await api.threads.addMember(thread.id, userId, {
   origin: ChannelTicket.name,
   reason: 'Adding claimer to staff thread',
  });

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.addClaimerToStaffThread.name);
  }
 }

 async lockStaffThread() {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const res = await api.channels.edit(
   thread.id,
   { locked: true },
   { origin: ChannelTicket.name, reason: 'Locking staff thread on close' },
  );

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.lockStaffThread.name);
  }
 }

 async archiveStaffThread() {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
  const res = await api.channels.edit(
   thread.id,
   { archived: true },
   { origin: ChannelTicket.name, reason: 'Archiving staff thread on delete' },
  );

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.archiveStaffThread.name);
  }
 }
}
