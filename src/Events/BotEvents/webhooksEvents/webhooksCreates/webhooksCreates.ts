import type * as Discord from 'discord.js';
import log from './log.js';

export default async (webhook: RWebhook, channel: Discord.GuildTextBasedChannel) => {
 webhook.client.util.cache.webhooks.set(webhook);
 log(webhook, channel);
};
