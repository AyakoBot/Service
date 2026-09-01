import {
 BotProfilePart,
 createBotProfileImageTransform,
 createBotProfileVirtual,
 createPresenceEmojiTransform,
} from '../../../Util/botProfile.js';
import { createBotTokenTransform } from '../../../Util/botTokenTransform.js';
import type WelcomePlugin from '../Plugin.js';

const lang = (plugin: unknown) => (plugin as WelcomePlugin).t(undefined);

export const welcomeBotTokenTransform = createBotTokenTransform(
 async (plugin) => {
  const t = await lang(plugin);
  return { invalid: t.botToken.invalid, keyMissing: t.botToken.keyMissing };
 },
 (plugin) => (plugin as WelcomePlugin).reconcileSatellites(),
);

export const welcomeProfileVirtual = (part: BotProfilePart) =>
 createBotProfileVirtual<{ guild: string; botToken: string | null }>(part, async (plugin) =>
  (await lang(plugin)).settings.profileWriteFailed(),
 );

export const welcomeProfileImageTransform = createBotProfileImageTransform(async (plugin) =>
 (await lang(plugin)).base.errors.notDiscordCdn(),
);

export const welcomePresenceEmojiTransform = createPresenceEmojiTransform(
 async (plugin, _guildId, name) =>
  (await lang(plugin)).settings.presenceEmojiNotFound({ name }),
);

export { BotProfilePart };
