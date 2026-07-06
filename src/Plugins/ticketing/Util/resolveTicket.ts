import { ChannelType } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { TicketThreadPrefix } from '../Classes/Enums.js';

import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';

export const resolveTicketByDm = async function (this: Client, channelId: string) {
 const dbTicket = await this.db.client.ticket.findFirst({
  where: { dm: channelId },
  include: { settings: true },
 });
 if (!dbTicket) return null;

 return getTicketClassBySettingsType.call(this, dbTicket.settings.type, String(dbTicket.id));
};

export const resolveTicketByChannel = async function (this: Client, channelId: string) {
 const dbTicket = await this.db.client.ticket.findFirst({
  where: { channel: channelId },
  include: { settings: true },
 });
 if (!dbTicket) return null;

 return getTicketClassBySettingsType.call(this, dbTicket.settings.type, String(dbTicket.id));
};

const resolveTicketByThreadPrefix = async function (
 this: Client,
 channelId: string,
 prefix: TicketThreadPrefix,
) {
 const threadOrChannel =
  (await this.cache.channels.get(channelId)) || (await this.cache.threads.get(channelId));
 if (!threadOrChannel) return null;

 const isThread = [
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
 ].includes(threadOrChannel.type);
 if (!isThread) return null;

 if (!threadOrChannel.name.startsWith(prefix)) return null;
 const ticketId = threadOrChannel.name.slice(prefix.length);
 if (!ticketId) return null;

 const dbTicket = await this.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!dbTicket) return null;

 return getTicketClassBySettingsType.call(this, dbTicket.settings.type, String(dbTicket.id));
};

export const resolveTicketByLogThread = function (this: Client, channelId: string) {
 return resolveTicketByThreadPrefix.call(this, channelId, TicketThreadPrefix.Log);
};

export const resolveTicketByStaffThread = function (this: Client, channelId: string) {
 return resolveTicketByThreadPrefix.call(this, channelId, TicketThreadPrefix.Staff);
};
