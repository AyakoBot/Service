import * as DiscordCore from '@discordjs/core';

import sendMessage from './sendMessage.js';

/**
 * Sends a reply message to a Discord channel.
 * @param msg The original message to reply to.
 * @param payload The message payload to send.
 * @returns A Promise that resolves with the sent message, or rejects with a DiscordAPIError.
 */
export default async (
 msg: RMessage,
 payload: Parameters<DiscordCore.ChannelsAPI['createMessage']>[1],
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return sendMessage(msg.guild_id, msg.channel_id, {
  ...payload,
  message_reference: {
   message_id: msg.id,
   channel_id: msg.channel_id,
   guild_id: msg.guild_id,
   fail_if_not_exists: false,
  },
 });
};
