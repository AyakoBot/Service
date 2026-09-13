import type { EconomySetting } from '@ayako/database';

import {
 BotProfilePart,
 createBotProfileImageTransform,
 createBotProfileVirtual,
} from '../../../Util/botProfile.js';
import type { SettingsFieldVirtual } from '../../settings/SettingsSchema.js';
import type EconomyPlugin from '../Plugin.js';

export { BotProfilePart };

export const botProfileVirtual = (part: BotProfilePart): SettingsFieldVirtual<EconomySetting> =>
 createBotProfileVirtual<EconomySetting>(part, async (plugin) =>
  (await (plugin as EconomyPlugin).t(undefined)).settings.profileWriteFailed(),
 );

export const botProfileImageTransform = createBotProfileImageTransform(async (plugin, guildId) =>
 (await (plugin as EconomyPlugin).t(guildId)).base.errors.notDiscordCdn(),
);
