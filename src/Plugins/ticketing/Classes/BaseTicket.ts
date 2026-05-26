import { Prisma, TicketState } from '@ayako/database';
import { logger } from '@ayako/utility';
import { ButtonStyle, ComponentType } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../Plugin.js';
import BaseTicketLogger, { LogType } from './BaseTicketLogger.js';
import { BaseTicketErrors } from './Enums.js';

export default class BaseTicket extends BaseTicketLogger {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 getTicketSettings = async (settingsId: string) => {
  logger.silly('[BaseTicket] getTicketSettings:', settingsId);
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
  logger.silly('[BaseTicket] claim attempt ticket:', this.id, 'by user:', userId);
  if (await this.isClosed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClosed);
  if (await this.isClaimed()) throw new Error(BaseTicketErrors.claim_TicketAlreadyClaimed);
  if (!(await this.isOpened())) throw new Error(BaseTicketErrors.claim_TicketNotOpened);

  const ticket = await this.getTicket();
  if (ticket.user === userId) throw new Error(BaseTicketErrors.claim_CreatorCannotClaim);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.claim_UserNotStaff);
  }

  logger.debug('[BaseTicket] claim guards passed ticket:', this.id);
  yield;

  const newTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.claimed },
   include: { settings: true },
  });

  this.dbTicket = newTicket;
  logger.log('[BaseTicket] claim ticket:', this.id, 'by user:', userId);
  this.handleBaseLog({ type: LogType.TicketClaimed, data: { userId } });

  return this;
 }

 async *isUserStaff(userId: string) {
  logger.silly('[BaseTicket] isUserStaff check user:', userId, 'ticket:', this.id);
  const ticket = await this.getTicket();
  if (ticket.settings.staffUsers.includes(userId)) return true;

  const member = await this.client.cache.members.get(ticket.settings.guild, userId);
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  const hasStaffRole = ticket.settings.staffRoles.some((r) => member.roles.includes(r));
  return hasStaffRole;
 }

 async *close({ userId }: { userId: string }) {
  logger.silly('[BaseTicket] close attempt ticket:', this.id, 'by user:', userId);
  if (await this.isClosed()) throw new Error(BaseTicketErrors.close_TicketAlreadyClosed);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.close_UserNotStaff);
  }

  logger.debug('[BaseTicket] close guards passed ticket:', this.id);
  yield;

  const newTicket = await this.db.ticket.update({
   where: { id: this.id },
   data: { state: TicketState.closed },
   include: { settings: true },
  });

  this.dbTicket = newTicket;

  logger.log('[BaseTicket] close ticket:', this.id, 'by user:', userId);
  this.handleBaseLog({ type: LogType.TicketClosed, data: { userId } });

  return this;
 }

 async *delete({ userId }: { userId: string }) {
  logger.silly('[BaseTicket] delete attempt ticket:', this.id, 'by user:', userId);
  const ticket = await this.getTicket();
  if (!ticket) throw new Error(BaseTicketErrors.delete_TicketNotFound);
  if (ticket.state !== TicketState.closed) throw new Error(BaseTicketErrors.delete_TicketNotClosed);

  const isUserStaff = this.isUserStaff(userId);
  let userIsStaff = (await isUserStaff.next()).value;

  if (!userIsStaff) {
   userIsStaff = (await isUserStaff.next()).value;
   if (!userIsStaff) throw new Error(BaseTicketErrors.delete_OnlyStaffCanDelete);
  }

  logger.debug('[BaseTicket] delete guards passed ticket:', this.id);
  yield;

  logger.log('[BaseTicket] delete ticket:', this.id, 'by user:', userId);
  this.handleBaseLog({ type: LogType.TicketDeleted, data: { userId } });

  return true;
 }

 async *create(
  dbOpts: { settingsId: string; userId: string },
  createOpts: { userId: string; roleIds: string[] },
 ) {
  logger.silly(
   '[BaseTicket] create attempt user:',
   dbOpts.userId,
   'settings:',
   dbOpts.settingsId,
  );
  const exists = await this.getTicket().catch(() => null);
  if (exists) throw new Error(BaseTicketErrors.create_TicketExists);

  const preparedEntry = await this.prepareEntry(dbOpts.userId, dbOpts.settingsId);
  this.dbTicket = preparedEntry;
  logger.debug('[BaseTicket] create prepared entry ticket:', this.id);
  const { channelId }: { channelId: string } = yield;

  try {
   const createDbEntry = this.createDbEntry({ ...dbOpts, channelId });
   const { iteration, result: settings } = (await createDbEntry.next()).value;

   if (iteration !== 1) throw new Error(BaseTicketErrors.create_DBEntryFailed);
   if (settings.denyUsers.includes(createOpts.userId))
    throw new Error(BaseTicketErrors.create_UserDenied);
   if (settings.denyRoles.some((r) => createOpts.roleIds.includes(r))) {
    throw new Error(BaseTicketErrors.create_RoleDenied);
   }

   logger.debug('[BaseTicket] create deny-list passed ticket:', this.id);
   yield;

   const ticket = (await createDbEntry.next()).value;
   if (ticket.iteration !== 2) throw new Error(BaseTicketErrors.create_DBEntryFailed);

   logger.log(
    '[BaseTicket] create ticket:',
    this.id,
    'for user:',
    dbOpts.userId,
    'channel:',
    channelId,
   );
   this.handleBaseLog({ type: LogType.TicketCreated, data: { userId: dbOpts.userId } });

   return this;
  } finally {
   this.deletePreparedEntry();
  }
 }

 async deletePreparedEntry() {
  const ticket = await this.getTicket();
  if (ticket.state !== TicketState.prepared) {
   logger.silly('[BaseTicket] deletePreparedEntry skip — state:', ticket.state);
   return;
  }

  logger.debug('[BaseTicket] deletePreparedEntry ticket:', ticket.id);
  this.db.ticket.delete({ where: { id: ticket.id } }).then();
 }

 async prepareEntry(userId: string, settingsId: string) {
  this.id = String(Date.now());
  logger.silly('[BaseTicket] prepareEntry id:', this.id, 'user:', userId);

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

 async *createDbEntry(dbOpts: { settingsId: string; userId: string; channelId: string }) {
  logger.silly(
   '[BaseTicket] createDbEntry settings:',
   dbOpts.settingsId,
   'user:',
   dbOpts.userId,
   'channel:',
   dbOpts.channelId,
  );
  const settings = await this.db.ticketSetting.findUnique({
   where: { id: dbOpts.settingsId },
   include: { Ticket: { where: { user: dbOpts.userId } } },
  });
  if (!settings) throw new Error(BaseTicketErrors.create_SettingsNotFound);
  if (!settings.channel) throw new Error(BaseTicketErrors.create_SettingsChannelNotFound);
  if (!settings.active) throw new Error(BaseTicketErrors.create_SettingsInactive);

  yield { iteration: 1 as const, result: settings };

  const preparedTicket = await this.getTicket();

  this.dbTicket = await this.db.ticket.update({
   data: {
    channel: dbOpts.channelId,
    user: dbOpts.userId,
    state: TicketState.opened,
   },
   where: { id: preparedTicket.id },
   include: { settings: true },
  });

  logger.debug('[BaseTicket] createDbEntry promoted ticket to opened:', this.dbTicket.id);
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
