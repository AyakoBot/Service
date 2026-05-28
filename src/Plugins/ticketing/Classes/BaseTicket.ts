import { RequestHandlerError } from '@ayako/api';
import { TicketState } from '@ayako/database';
import { LogLevel, type RMessage } from '@ayako/utility';
import { ButtonStyle, ComponentType, MessageFlags } from 'discord-api-types/v10';
import { inspect } from 'node:util';
import type Client from '../../../Classes/Client.js';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../Plugin.js';
import BaseTicketLogger, { LogType } from './BaseTicketLogger.js';
import { BaseTicketErrors, ChannelTicketErrors } from './Enums.js';
import { cloneMessageIntoContainer } from '../../../Util/cloneMessageIntoContainer.js';
import ChannelTicket from './ChannelTicket.js';
import emotes from '../../../Classes/Emotes.js';
import constants from '../../../Classes/Constants.js';

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

 async *close({ userId }: { userId: string }) {
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
  this.handleBaseLog({ type: LogType.TicketClosed, data: { userId } });

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
  yield;

  this.handleBaseLog({ type: LogType.TicketDeleted, data: { userId } });

  return true;
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

 /**
  * mentionUser is true in TicketType Channel and Thread
  * showPrefixes is true in TicketType DM
  */
 async getInitPayload(mentionUser: boolean, showPrefixes: boolean) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  // TODO: set custom embed
  const initPayload = new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Creating initial ticket message',
  }).setContent('This will be a custom embed');

  return new MessagePayload(this.client, {
   origin: BaseTicket.name,
   reason: 'Creating ticket message',
  })
   .setAllowedMentionsUsers([...ticket.settings.mentionUsers, ticket.user])
   .setAllowedMentionsRoles(ticket.settings.mentionRoles)
   .setContent(
    `${
     mentionUser ? `<@${ticket.user}>` : ''
    }\n${ticket.settings.mentionRoles.map((r) => `<@&${r}>`).join(' ')}\n${ticket.settings.mentionUsers
     .map((u) => `<@${u}>`)
     .join(' ')}`,
   )
   .setEmbeds([
    initPayload.embeds?.[0] || null,
    ...(ticket.settings.sendMessagePrefixes.length && showPrefixes
     ? [
        {
         author: { name: t.replyWith() },
         description: ticket.settings.sendMessagePrefixes.map((p) => `\`${p}\``).join(', '),
        },
       ]
     : []),
   ])
   .setComponents([
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
   ]);
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

  const container = this.createMessageContainer(
   `${constants.formatters.getEmote(emotes.Member)} ${user?.username || t.base.t.unknownUser()}`,
  );
  cloneMessageIntoContainer.call(container, msg);

  this.sendMessage(
   new MessagePayload(this.client, {
    origin: ChannelTicket.name,
    reason: 'Logging sent message',
   })
    .setComponents([container.toJSON()])
    .setFlags(MessageFlags.IsComponentsV2),
  );
 }
}
