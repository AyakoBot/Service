import { RequestHandlerError } from '@ayako/api';
import type { ConfessionSetting } from '@ayako/database';
import { MessageFlags } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type ConfessionsPlugin from '../Plugin.js';
import { authorSubject, logContainer, type ConfessionLogEvent } from '../Util/logContainer.js';

export default class ConfessionLogger {
 plugin: ConfessionsPlugin;
 client: Client;

 constructor(plugin: ConfessionsPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 record = async (settings: ConfessionSetting, event: ConfessionLogEvent): Promise<void> => {
  if (!settings.logChannel) return;

  const t = await this.plugin.t(settings.guild);
  const api = await this.plugin.getAPI(settings.guild);
  const user = event.author ? await this.client.cache.users.get(event.author) : null;
  const subject = authorSubject(t, event.author, user ?? null);

  const res = await api.channels.createMessage(
   settings.logChannel,
   {
    flags: MessageFlags.IsComponentsV2,
    components: [logContainer(t, event, this.client.emojis.for(api), subject)],
    allowed_mentions: { parse: [] },
   },
   { origin: this.plugin.name, reason: 'Confession log' },
  );

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'confession log');
 };
}
