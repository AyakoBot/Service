import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import requestHandlerError from '../../requestHandlerError.js';
import resolvePartialEmoji from '../../resolvePartialEmoji.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes the reaction of the bot on a message.
 * @param msg - The message object to delete the reaction from.
 * @param emoji - The emoji to delete from the message.
 * @returns A promise that resolves with the deleted reaction or rejects with an error.
 */
export default async (msg: RMessage, emoji: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const resolvedEmoji = resolvePartialEmoji(emoji);
 if (!resolvedEmoji) {
  const e = requestHandlerError(`Invalid Emoji ${emoji}`, []);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .deleteOwnMessageReaction(
   msg.channel_id,
   msg.id,
   resolvedEmoji.id
    ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
    : (resolvedEmoji.name as string),
  )
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};
