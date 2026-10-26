import {
 BotProfilePart,
 createBotProfileImageTransform,
 createBotProfileVirtual,
 createPresenceEmojiTransform,
} from '../../../Util/botProfile.js';
import { createBotTokenTransform } from '../../../Util/botTokenTransform.js';
import type GiveawaysPlugin from '../Plugin.js';

const lang = (plugin: unknown) => (plugin as GiveawaysPlugin).t(undefined);

export const giveawayBotTokenTransform = createBotTokenTransform(
 async (plugin) => {
  const t = await lang(plugin);
  return { invalid: t.botToken.invalid, keyMissing: t.botToken.keyMissing };
 },
 (plugin) => (plugin as GiveawaysPlugin).reconcileSatellites(),
);

export const giveawayProfileVirtual = (part: BotProfilePart) =>
 createBotProfileVirtual<{ guild: string; botToken: string | null }>(part, async (plugin) =>
  (await lang(plugin)).settings.profileWriteFailed(),
 );

export const giveawayProfileImageTransform = createBotProfileImageTransform(async (plugin) =>
 (await lang(plugin)).base.errors.notDiscordCdn(),
);

export const giveawayPresenceEmojiTransform = createPresenceEmojiTransform(
 async (plugin, _guildId, name) =>
  (await lang(plugin)).settings.presenceEmojiNotFound({ name }),
);

export { BotProfilePart };
