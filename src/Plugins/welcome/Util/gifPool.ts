import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';

import type WelcomePlugin from '../Plugin.js';

const imageExtensions = ['.gif', '.jpg', '.png', '.webp', '.jpeg', '.apng', '.avif'];
const urlRegex = /https?:\/\/\S+/g;

const convertTenorToGif = (url?: string) =>
 (url && url.includes('tenor.com') && !url.includes('c.tenor.com')
  ? `https://c.tenor.com/${url.split(/\/+/g)[2]?.slice(0, -2)}AC/tenor.gif`
  : url);

export const extractGifUrls = (msg: GatewayMessageCreateDispatchData) => {
 const contentUrls = (msg.content.match(urlRegex) ?? []).filter((u) => !u.includes('tenor.com'));
 const videoUrls = (msg.embeds ?? [])
  .map((e) => convertTenorToGif(e.video?.url))
  .filter((u): u is string => !!u?.length);
 const attachmentUrls = (msg.attachments ?? []).map((a) => a.url);

 return [
  ...new Set(
   [...attachmentUrls, ...contentUrls, ...videoUrls].filter((u) =>
    imageExtensions.some((ext) => u.includes(ext)),
   ),
  ),
 ];
};

export const pickRandomGif = async function (
 this: WelcomePlugin,
 guildId: string,
 channelId: string,
) {
 const where = { guild: guildId, channel: channelId };
 const count = await this.client.db.client.welcomeGif.count({ where });
 if (!count) return null;

 const row = await this.client.db.client.welcomeGif.findFirst({
  where,
  skip: Math.floor(Math.random() * count),
  select: { url: true },
 });
 return row?.url ?? null;
};
