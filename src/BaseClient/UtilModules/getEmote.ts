import * as Discord from 'discord.js';

type DirectProperties<T> = Pick<T, keyof T>;

/**
 * Retrieves an emoji from the cache by its ID.
 * @param idPair - The ID pair of the emoji in the format
 * `emojiName:emojiId` or `a:emojiName:emojiId`.
 * @returns The emoji object if found, otherwise `undefined`.
 */
export default async (idPair: string) => {
 if (!idPair.includes(':')) return Discord.parseEmoji(idPair);

 const client = (await import('../Client.js')).default;

 const response = (await client.cluster?.broadcastEval((c, { id }) => c.emojis?.cache.get(id), {
  context: { id: idPair.split(/:/g).at(-1) as string },
 })) as DirectProperties<Discord.GuildEmoji>[];

 return response?.find((e) => !!e);
};
