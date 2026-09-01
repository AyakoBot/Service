import { fetchDiscordCdn, isDiscordCdnUrl, toDataUri } from './discordCdn.js';
import { emojiCdnUrl, parseEmojiInput } from './emojiInput.js';

export enum RoleIconError {
 NotDiscordCdn = 'not-discord-cdn',
 FetchFailed = 'fetch-failed',
 NoInput = 'no-input',
 FeatureMissing = 'feature-missing',
}

export type RoleIconSource = { unicodeEmoji: string } | { icon: string } | { error: RoleIconError };

const downloadIcon = async (url: string): Promise<RoleIconSource> => {
 if (!isDiscordCdnUrl(url)) return { error: RoleIconError.NotDiscordCdn };

 const file = await fetchDiscordCdn(url);
 if (!file) return { error: RoleIconError.FetchFailed };

 return { icon: toDataUri(file.contentType, file.data) };
};

export const resolveRoleIconSource = async (input: {
 emoji?: string;
 attachmentUrl?: string;
 url?: string;
}): Promise<RoleIconSource> => {
 if (input.emoji) {
  const parsed = parseEmojiInput(input.emoji);
  if (!parsed) return { error: RoleIconError.NotDiscordCdn };

  const url = emojiCdnUrl(parsed);
  return url ? downloadIcon(url) : { unicodeEmoji: parsed.name };
 }

 if (input.attachmentUrl) return downloadIcon(input.attachmentUrl);
 if (input.url) return downloadIcon(input.url);

 return { error: RoleIconError.NoInput };
};
