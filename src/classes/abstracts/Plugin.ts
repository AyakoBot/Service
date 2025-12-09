import type { APIApplicationCommand, GatewayDispatchEvents } from '@discordjs/core';

import type { GatewayEventHandlers, GatewayEventPayloadMap } from '../../types/gateway.js';
import type Client from '../Client.js';

export default abstract class Plugin<E extends GatewayDispatchEvents = GatewayDispatchEvents> {
 client: Client;
 abstract name: string;
 enabled: boolean = true;
 abstract eventHandlers: GatewayEventHandlers<E>;

 constructor(client: Client) {
  this.client = client;

  queueMicrotask(() => this.registerEvents());
 }

 private registerEvents() {
  const events = Object.keys(this.eventHandlers) as E[];
  events.forEach((event) => {
   this.client.cache.on(event, (data: GatewayEventPayloadMap[E]) => {
    this.eventHandlers[event](data);
   });
  });
 }

 enable = () => (this.enabled = true);
 disable = () => (this.enabled = false);
 isEnabled = () => this.enabled;

 abstract getCommands(): APIApplicationCommand[];
}
