import type { TicketSetting } from '@ayako/database';

import {
 BotProfilePart,
 createBotProfileImageTransform,
 createBotProfileVirtual,
} from '../../../Util/botProfile.js';
import type { SettingsFieldVirtual } from '../../settings/SettingsSchema.js';
import type TicketPlugin from '../Plugin.js';

export { BotProfilePart };

export const botProfileVirtual = (
 part: BotProfilePart,
): SettingsFieldVirtual<TicketSetting> =>
 createBotProfileVirtual<TicketSetting>(part, async (plugin) =>
  (await (plugin as TicketPlugin).t(undefined)).settings.profileWriteFailed(),
 );

export const botProfileImageTransform = createBotProfileImageTransform(async (plugin, guildId) =>
 (await (plugin as TicketPlugin).t(guildId)).base.errors.notDiscordCdn(),
);
