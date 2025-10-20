import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 oldWebhook: RWebhook,
 webhook: RWebhook,
 channel: RChannel,
) => {
 webhook.client.util.cache.webhooks.set(webhook);
 log(oldWebhook, webhook, channel);
};
