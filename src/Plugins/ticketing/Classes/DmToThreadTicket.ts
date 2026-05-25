import type { API } from '@ayako/api';
import type { RChannel, RThread } from '@ayako/utility';
import type { APIChannel } from 'discord-api-types/v10';
import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';
import { DMTicketMixin } from './DMTicket.js';
import ThreadTicket from './ThreadTicket.js';

export default class DmToThreadTicket extends DMTicketMixin(ThreadTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }

 async createChannel(api: API, username: string) {
  const initDmPayload = await this.getInitDmPayload();
  const dmMessage = await this.forwardToDmChannel(initDmPayload);
  await this.setStarterDm(dmMessage?.id);
  await this.pinMessage(dmMessage);

  return super.createChannel(api, username);
 }

 async claimChannel(
  api: API,
  channelId: string,
  guildId: string,
  channelName: string,
 ): Promise<APIChannel> {
  return super.claimChannel(api, channelId, guildId, channelName);
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  const closeDmPayload = await this.getCloseDmPayload();
  await this.forwardToDmChannel(closeDmPayload);
  await this.unpinStartMessage();

  return super.closeChannel(api, channel);
 }
}
