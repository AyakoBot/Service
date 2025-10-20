import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 pin: RMessage,
 channel:
  | RChannel
  | RChannel
  | RThread
  | Discord.PublicThreadChannel
  | Discord.VoiceChannel,
) => {
 log(pin, channel);
};
