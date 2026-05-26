import type { API } from '@ayako/api';
import { logger, type RChannel, type RThread } from '@ayako/utility';
import type { APIChannel } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';
import ChannelTicket from './ChannelTicket.js';
import { DMTicketMixin } from './DMTicket.js';

export default class DmToChannelTicket extends DMTicketMixin(ChannelTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 async createChannel(api: API, username: string, settingsId: string) {
  logger.silly('[DmToChannelTicket] createChannel ticket:', this.id);
  const initDmPayload = await this.getInitDmPayload();
  const dmMessage = await this.forwardToDmChannel(initDmPayload);
  await this.setStarterDm(dmMessage?.id);
  await this.pinMessage(dmMessage);

  return super.createChannel(api, username, settingsId);
 }

 async claimChannel(
  api: API,
  channelId: string,
  guildId: string,
  channelName: string,
 ): Promise<APIChannel> {
  logger.silly('[DmToChannelTicket] claimChannel ticket:', this.id);
  return super.claimChannel(api, channelId, guildId, channelName);
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  logger.silly('[DmToChannelTicket] closeChannel ticket:', this.id);
  const closeDmPayload = await this.getCloseDmPayload();
  await this.forwardToDmChannel(closeDmPayload);
  await this.unpinStartMessage();

  return super.closeChannel(api, channel);
 }
}
