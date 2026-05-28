import { API, RequestHandlerError } from '@ayako/api';
import { TicketType } from '@ayako/database';
import { LogLevel, type RChannel, type RThread } from '@ayako/utility';
import { ChannelType } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import getUser from '../../../Util/getUser.js';
import TicketPlugin from '../Plugin.js';
import ChannelTicket from './ChannelTicket.js';
import { ThreadTicketErrors } from './Enums.js';

export default class ThreadTicket extends ChannelTicket {
 channelTicket: ChannelTicket;

 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
  this.channelTicket = new ChannelTicket(client, ticketId, plugin);
 }

 static async findTicketByThreadChannelId(client: Client, channelId: string) {
  const entry = await client.db.client.ticket.findFirst({
   where: { dm: channelId },
   include: { settings: true },
  });
  if (!entry) return null;

  const ticketPlugin = client.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;
  if (!ticketPlugin) throw new Error('TicketPlugin not found');

  if (entry.settings.type !== TicketType.Thread) {
   throw new Error('Ticket found, but it is not a ThreadTicket');
  }

  return new ThreadTicket(client, String(entry.id), ticketPlugin);
 }

 async deleteChannel() {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  let user = await getUser.call(this.client, ticket.user);
  if (!user || user instanceof RequestHandlerError) {
   this.plugin.nonFatalError(user || new Error(), this.deleteChannel.name);
   user = null;
  }

  const t = await this.plugin.t(ticket.settings.guild);
  const api = await this.client.getAPI(ticket.settings.guild);

  const res = await api.channels.edit(
   ticket.channel,
   {
    archived: true,
    locked: true,
    name: `${t.archived()}-${user?.username || t.base.t.unknownUser()}`,
   },
   { origin: ThreadTicket.name, reason: 'Archiving ticket thread channel' },
  );

  if (!res || res instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.threadNotFound, { cause: res });
  }

  return res;
 }

 async revokeChannelAccess(api: API) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const remove = await api.threads.removeMember(ticket.channel, ticket.user, {
   origin: ThreadTicket.name,
   reason: 'Ticket closed',
  });

  if (remove instanceof RequestHandlerError) {
   this.plugin.nonFatalError(remove, this.revokeChannelAccess.name);
  }

  return remove ? [remove] : [];
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  let user = await getUser.call(this.client, ticket.user);

  if (!user || user instanceof RequestHandlerError) {
   this.plugin.nonFatalError(user || new Error(), this.closeChannel.name);
   user = null;
  }

  this.revokeChannelAccess(api);

  const modify = await api.channels.edit(
   ticket.channel,
   {
    name: `${t.closed()}-${user?.username || channel.name.replace(`${t.archived()}-`, '')}`.slice(
     0,
     30,
    ),
    locked: true,
   },
   { origin: ThreadTicket.name, reason: 'Closing ticket thread channel' },
  );

  return modify;
 }

 async getChannel(id: string) {
  const channel = await this.client.cache.threads.get(id);
  if (!channel) throw new Error(ThreadTicketErrors.threadNotFound);

  return channel;
 }

 async createChannel(api: API, username: string) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  if (!ticket.settings.channel) {
   throw new Error(ThreadTicketErrors.threadChannelNotSet);
  }

  const thread = await api.channels.createThread(
   ticket.settings.channel,
   {
    name: username,
    type: ChannelType.PrivateThread,
    auto_archive_duration: Number(ticket.settings.archiveDuration),
   },
   undefined,
   { origin: ThreadTicket.name, reason: 'Creating thread for ticket' },
  );

  if (!thread || thread instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.create_CantCreateChannel, { cause: thread });
  }

  return thread;
 }

 async grantChannelAccess(api: API, channelId: string, userId: string): Promise<void> {
  this.plugin.logger.logLocation(LogLevel.debug);

  const modify = await api.threads.addMember(channelId, userId, {
   origin: ThreadTicket.name,
   reason: 'Granting access to ticket thread channel',
  });

  if (modify instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.create_CantUpdatePermissions, { cause: modify });
  }

  return modify;
 }
}
