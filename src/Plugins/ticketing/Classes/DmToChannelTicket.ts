import type { API } from '@ayako/api';
import { LogLevel, type RChannel, type RThread } from '@ayako/utility';
import type { APIChannel } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';
import ChannelTicket from './ChannelTicket.js';
import { DMTicketMixin } from './DMTicket.js';
import { DMTicketErrors } from './Enums.js';

export default class DmToChannelTicket extends DMTicketMixin(ChannelTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 async createChannel(api: API, username: string, settingsId: string) {
  this.plugin.logger.logLocation(LogLevel.silly);

  await this.setDmChannel();
  const superCreate = await super.createChannel(api, username, settingsId);

  const initDmPayload = await this.getInitDmPayload();
  const dmMessage = await this.forwardToDmChannel(initDmPayload);
  if (!dmMessage) throw new Error(DMTicketErrors.cantSendMessage);

  await this.setStarterDm(dmMessage.id);
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
  const closeDmPayload = await this.getCloseDmPayload();
  await this.forwardToDmChannel(closeDmPayload);
  await this.unpinStartMessage();

  return superClose;
 }
}
