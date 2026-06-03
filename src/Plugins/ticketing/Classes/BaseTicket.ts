import { inspect } from 'node:util';

import { RequestHandlerError } from '@ayako/api';
import { TicketState } from '@ayako/database';
import { LogLevel, type RMessage } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 ComponentType,
 MessageFlags,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { cloneMessageIntoContainer } from '../../../Util/cloneMessageIntoContainer.js';
import fetchMessages from '../../../Util/fetchMessages.js';
import type TicketPlugin from '../Plugin.js';

import BaseTicketLogger, { LogType } from './BaseTicketLogger.js';
import ChannelTicket from './ChannelTicket.js';
import { BaseTicketErrors, ChannelTicketErrors } from './Enums.js';

export interface MirrorRef {
 channelId: string;
 messageId: string;
 isDm: boolean;
}

const mirrorButtonMatches = (components: unknown, customId: string): boolean => {
 if (!Array.isArray(components)) return false;

 return components.some((c) => {
  if (!c || typeof c !== 'object') return false;

  const comp = c as Record<string, unknown>;
  if (comp.type === ComponentType.Button && comp.custom_id === customId) return true;
  if (mirrorButtonMatches(comp.components, customId)) return true;

  return mirrorButtonMatches(comp.accessory ? [comp.accessory] : null, customId);
 });
};

export default class BaseTicket extends BaseTicketLogger {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 getTicketSettings = async (settingsId: string) => {
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
   data: { state: TicketState.claimed },
   include: { settings: true },
  });

  this.dbTicket = newTicket;
  this.handleBaseLog({ type: LogType.TicketClaimed, data: { userId } });

  return this;
 }

 async canUserClose(userId: string) {
  const isStaff = await this.isUserStaff(userId);
  if (isStaff) return true;

  const ticket = await this.getTicket();
  if (ticket.settings.allowCreatorClose && ticket.user === userId) return true;

  return false;
 }

 async canUserClaim(userId: string) {
  return this.isUserStaff(userId);
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

  const newTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.closed },
   include: { settings: true },
  });

  this.dbTicket = newTicket;
  this.handleBaseLog({ type: LogType.TicketClosed, data: { userId, reason } });

  return this;
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
 }

 async *create(
  dbOpts: { settingsId: string; userId: string },
  createOpts: { userId: string; roleIds: string[] },
 ) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const exists = await this.getTicket().catch(() => null);
  if (exists) throw new Error(BaseTicketErrors.create_TicketExists);

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

 async prepareEntry(userId: string, settingsId: string) {
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
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const components: APIMessageTopLevelComponent[] = [];

  const mentionLine = [
   mentionUser ? `<@${ticket.user}>` : '',
   ticket.settings.mentionRoles.map((r) => `<@&${r}>`).join(' '),
   ticket.settings.mentionUsers.map((u) => `<@${u}>`).join(' '),
  ]
   .filter((s) => s.length)
   .join('\n');
  if (mentionLine) components.push(new TextDisplayBuilder().setContent(mentionLine).toJSON());

  // TODO: set custom embed

  if (staffThreadId) {
   components.push(
    new TextDisplayBuilder()
     .setContent(`-# ${t.staffThreadMention({ channel: `<#${staffThreadId}>` })}`)
     .toJSON(),
   );
  }

  if (ticket.settings.sendMessagePrefixes.length) {
   components.push(
    this.buildReplyPrefixContainer(t.replyWith(), ticket.settings.sendMessagePrefixes),
   );
  }

  components.push(
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      custom_id: `info/user_${ticket.user}`,
      label: t.userInfo(),
      style: ButtonStyle.Secondary,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      custom_id: `tickets/close_${ticket.id}`,
      label: t.closeTicket(),
      style: ButtonStyle.Danger,
     },
     {
      type: ComponentType.Button,
      custom_id: `tickets/claim_${ticket.id}`,
      label: t.claimTicket(),
      style: ButtonStyle.Success,
     },
    ],
   },
  );

  return new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Creating ticket message',
  })
   .setAllowedMentionsUsers([...ticket.settings.mentionUsers, ticket.user])
   .setAllowedMentionsRoles(ticket.settings.mentionRoles)
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(components);
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

 async forwardToTicketChannel(msg: RMessage) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const user = await this.getUser(msg.author_id);
  const name = user?.username || t.base.t.unknownUser();

  const container = this.buildMirrorContainer(
   msg,
   `${constants.formatters.getEmote(emotes.Member)} ${name}`,
  );

  this.sendMessage(
   new MessagePayload(this.client, {
    origin: ChannelTicket.name,
    reason: 'Logging sent message',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  );
 }

 buildMirrorContainer(msg: RMessage, authorName: string) {
  const container = new ContainerBuilder();
  cloneMessageIntoContainer.call(container, msg, { authorName, context: msg.id });
  return container;
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
  const matches = (m: { components?: unknown }) => mirrorButtonMatches(m.components, originalId);

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
   authorName = `${emotes.tools.name} | ${t.SupportTeam()}`;
  } else {
   const user = await this.getUser(msg.author_id);
   const name = user?.username || t.base.t.unknownUser();
   authorName = `${constants.formatters.getEmote(emotes.Member)} ${name}`;
  }

  const payload = new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Editing mirrored message',
  })
   .setComponents([this.buildMirrorContainer(msg, authorName).toJSON()])
   .setFlags(MessageFlags.IsComponentsV2);

  if (mirror.isDm) await payload.editDM(mirror.channelId, mirror.messageId);
  else await payload.edit(mirror.channelId, mirror.messageId);
 }

 async deleteMirror(mirror: MirrorRef) {
  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);
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
  const api = await this.client.getAPI(ticket.settings.guild);
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
  const api = await this.client.getAPI(ticket.settings.guild);
  const opts = { origin: BaseTicket.name, reason: 'Marking message forwarded to the user' };
  const main = constants.formatters.getEmoteIdentifier(emotes.tickWithBackground);

  if (msg.channel_id === ticket.dm) {
   const dmEmote = constants.formatters.getEmoteIdentifier({ name: '✅' });
   const res = await api.channels.addDirectMessageReaction(msg.channel_id, msg.id, dmEmote, opts);
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
}
