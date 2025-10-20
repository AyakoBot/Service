import type * as Discord from 'discord.js';
import log from './log.js';
import welcomeGifChannel from './welcomeGifChannel.js';

export default async (
 msgs: Discord.Collection<Discord.Snowflake, RMessage>,
 channel: RChannel,
) => {
 welcomeGifChannel(msgs, channel)
 log(msgs, channel);
};
