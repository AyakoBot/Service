import { Prisma, TicketState, TicketType } from '@ayako/database';
import { ButtonStyle, ComponentType } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../Plugin.js';
import BaseTicketLogger, { LogType } from './BaseTicketLogger.js';
import ChannelTicket from './ChannelTicket.js';
import DmToChannelTicket from './DmToChannelTicket.js';
import DmToThreadTicket from './DmToThreadTicket.js';
import { BaseTicketErrors } from './Enums.js';
import ThreadTicket from './ThreadTicket.js';

export default class BaseTicket extends BaseTicketLogger {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 static async getTicketById(client: Client, ticketId: string) {
  const entry = await client.db.client.ticket.findUnique({
   where: { id: ticketId },
   include: { settings: true },
  });
  if (!entry) return null;
  const plugin = client.plugins.find((p) => p.name === 'Ticketing') as TicketPlugin;

  switch (entry.settings.type) {
   case TicketType.dmToChannel:
    return new DmToChannelTicket(client, ticketId, plugin);

   case TicketType.dmToThread:
    return new DmToThreadTicket(client, ticketId, plugin);

   case TicketType.Channel:
    return new ChannelTicket(client, ticketId, plugin);

   case TicketType.Thread:
    return new ThreadTicket(client, ticketId, plugin);

   default:
    throw new Error(BaseTicketErrors.unknownTicketType, { cause: entry.settings.type });
  }
 }

 isOpened = async () => {
  const ticket = await this.getTicket();
  return { opened: ticket.state === TicketState.opened, ticket: ticket };
 };

 isClosed = async () => {
  const ticket = await this.getTicket();
  return { closed: ticket.state === TicketState.closed, ticket };
 };

 isClaimed = async () => {
  const ticket = await this.getTicket();
  return { claimed: ticket.state === TicketState.claimed, ticket };
 };

 async *claim({ userId }: { userId: string }) {
  if (await this.isClosed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClosed);
  if (await this.isClaimed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClaimed);
  if (!(await this.isOpened()).opened) throw new Error(BaseTicketErrors.claim_TicketNotOpened);

  const ticket = await this.getTicket();
  if (ticket.user === userId) throw new Error(BaseTicketErrors.claim_CreatorCannotClaim);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.claim_UserNotStaff);
  }

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

 async *isUserStaff(userId: string) {
  const ticket = await this.getTicket();
  if (ticket.settings.staffUsers.includes(userId)) return true;

  const member = await this.client.cache.members.get(ticket.settings.guild, userId);
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  const hasStaffRole = ticket.settings.staffRoles.some((r) => member.roles.includes(r));
  return hasStaffRole;
 }

 async *close({ userId }: { userId: string }) {
  if (await this.isClosed()) throw new Error(BaseTicketErrors.close_TicketAlreadyClosed);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.close_UserNotStaff);
  }

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
  const ticket = await this.getTicket();
  if (!ticket) throw new Error(BaseTicketErrors.delete_TicketNotFound);
  if (ticket.state !== TicketState.closed) throw new Error(BaseTicketErrors.delete_TicketNotClosed);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.delete_OnlyStaffCanDelete);
  }

  yield;

  this.handleBaseLog({ type: LogType.TicketDeleted, data: { userId } });

  return true;
 }

 async *create(
  dbOpts: { settingsId: string; userId: string; channelId: string },
  createOpts: { userId: string; roleIds: string[] },
 ) {
  const exists = await this.getTicket().catch(() => null);
  if (exists) throw new Error(BaseTicketErrors.create_TicketExists);

  const createDbEntry = this.createDbEntry(dbOpts);
  createDbEntry.next();

  const { iteration, result: settings } = (await createDbEntry.next()).value;
  if (iteration !== 1) throw new Error(BaseTicketErrors.create_DBEntryFailed);
  if (settings.denyUsers.includes(createOpts.userId))
   throw new Error(BaseTicketErrors.create_UserDenied);
  if (settings.denyRoles.some((r) => createOpts.roleIds.includes(r))) {
   throw new Error(BaseTicketErrors.create_RoleDenied);
  }

  yield;

  const ticket = (await createDbEntry.next()).value;
  if (ticket.iteration !== 2) throw new Error(BaseTicketErrors.create_DBEntryFailed);

  this.handleBaseLog({ type: LogType.TicketCreated, data: { userId: dbOpts.userId } });

  return this;
 }

 async *createDbEntry(dbOpts: { settingsId: string; userId: string; channelId: string }) {
  const settings = await this.db.ticketSetting.findUnique({
   where: { id: dbOpts.settingsId },
   include: { Ticket: { where: { user: dbOpts.userId } } },
  });
  if (!settings) throw new Error(BaseTicketErrors.create_SettingsNotFound);
  if (!settings.channel) throw new Error(BaseTicketErrors.create_SettingsChannelNotFound);
  if (!settings.active) throw new Error(BaseTicketErrors.create_SettingsInactive);

  yield { iteration: 1 as const, result: settings };

  const ticketId = Date.now().toString();

  const createTicketPayload: Prisma.TicketCreateInput = {
   channel: dbOpts.channelId,
   id: ticketId,
   user: dbOpts.userId,
   settings: { connect: { id: dbOpts.settingsId } },
   state: TicketState.opened,
  };

  const ticket = await this.db.ticket.create({ data: createTicketPayload });
  this.dbTicket = { ...ticket, settings };

  yield {
   iteration: 2 as const,
   result: this.dbTicket,
  };
  return { iteration: 3 as const, result: undefined };
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
}
