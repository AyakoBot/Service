import type { API } from '@ayako/api';
import { LogLevel, type RChannel, type RThread } from '@ayako/utility';
import type { APIChannel } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';

import { DMTicketMixin } from './DMTicket.js';
import { DMTicketErrors } from './Enums.js';
import ThreadTicket from './ThreadTicket.js';

export default class DmToThreadTicket extends DMTicketMixin(ThreadTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 async createChannel(api: API, username: string) {
  this.plugin.logger.logLocation(LogLevel.silly);

  await this.setDmChannel();
  const superCreate = await super.createChannel(api, username);

  const initDmPayload = await this.getInitDmPayload();
  const dmMessage = await this.forwardToDmChannel(initDmPayload);
  if (!dmMessage) throw new Error(DMTicketErrors.cantSendMessage);

  await this.setStarterDm(dmMessage?.id || null);
  await this.pinMessage(dmMessage);

  return superCreate;
 }

 async claimChannel(
  api: API,
  channelId: string,
  guildId: string,
  channelName: string,
 ): Promise<APIChannel> {
  this.plugin.logger.logLocation(LogLevel.silly);
  return super.claimChannel(api, channelId, guildId, channelName);
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const superClose = await super.closeChannel(api, channel);
  await this.unpinStartMessage();

  return superClose;
 }
}
