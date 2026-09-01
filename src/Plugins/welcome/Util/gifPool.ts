import type { APIMessage } from 'discord-api-types/v10';

import { isDiscordCdnUrl } from '../../../Util/discordCdn.js';
import { mintId } from '../../../Util/mintId.js';
import type { GreetingKind } from '../Classes/Enums.js';
import type WelcomePlugin from '../Plugin.js';

const imageExtensions = ['.gif', '.jpg', '.png', '.webp', '.jpeg', '.apng', '.avif'];
const urlRegex = /https?:\/\/\S+/g;
const maxUrlLength = 512;

const stripSignedParams = (url: string) =>
 (isDiscordCdnUrl(url) ? (url.split('?')[0] ?? url) : url);

const isImageUrl = (url: string) => imageExtensions.some((ext) => url.includes(ext));

const convertTenorToGif = (url?: string) =>
 (url && url.includes('tenor.com') && !url.includes('c.tenor.com')
  ? `https://c.tenor.com/${url.split(/\/+/g)[2]?.slice(0, -2)}AC/tenor.gif`
  : url);

export const hasPendingEmbed = (msg: Pick<APIMessage, 'content' | 'embeds'>) =>
 !msg.embeds?.length && /https?:\/\/\S*(tenor\.com|giphy\.com)\S*/.test(msg.content ?? '');

export const extractGifUrls = (msg: Pick<APIMessage, 'content' | 'embeds' | 'attachments'>) => {
 const contentUrls = (msg.content?.match(urlRegex) ?? []).filter((u) => !u.includes('tenor.com'));
 const embedUrls = (msg.embeds ?? [])
  .map((e) =>
   [convertTenorToGif(e.video?.url), e.image?.url, e.thumbnail?.url]
    .filter((u): u is string => !!u?.length)
    .find(isImageUrl),
  )
  .filter((u): u is string => !!u);
 const attachmentUrls = (msg.attachments ?? []).map((a) => a.url);

 return [
  ...new Set(
   [...attachmentUrls, ...contentUrls, ...embedUrls]
    .map(stripSignedParams)
    .filter((u) => u.length <= maxUrlLength)
    .filter(isImageUrl),
  ),
 ];
};

export const saveGifs = async function (
 this: WelcomePlugin,
 guildId: string,
 kind: GreetingKind,
 msg: Pick<APIMessage, 'content' | 'embeds' | 'attachments'>,
) {
 const urls = extractGifUrls(msg);
 if (!urls.length) return { found: 0, added: 0 };

 const { count } = await this.client.db.client.welcomeGif.createMany({
  data: urls.map((url) => ({ id: mintId(), guild: guildId, kind, url })),
  skipDuplicates: true,
 });

 return { found: urls.length, added: count };
};

export const countGifs = async function (
 this: WelcomePlugin,
 guildId: string,
 kind: GreetingKind,
): Promise<number> {
 return this.client.db.client.welcomeGif.count({ where: { guild: guildId, kind } });
};

export const listGifs = async function (
 this: WelcomePlugin,
 guildId: string,
 kind: GreetingKind,
 skip: number,
 take: number,
) {
 return this.client.db.client.welcomeGif.findMany({
  where: { guild: guildId, kind },
  orderBy: { id: 'asc' },
  select: { id: true, url: true },
  skip,
  take,
 });
};

export const pickRandomGif = async function (
 this: WelcomePlugin,
 guildId: string,
 kind: GreetingKind,
) {
 const where = { guild: guildId, kind };
 const count = await this.client.db.client.welcomeGif.count({ where });
 if (!count) return null;

 const row = await this.client.db.client.welcomeGif.findFirst({
  where,
  skip: Math.floor(Math.random() * count),
  select: { url: true },
 });
 return row?.url ?? null;
};
