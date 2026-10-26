import type { API } from '@ayako/api';
import type { TicketSetting } from '@ayako/database';
import { decrypt, getBotIdFromToken } from '@ayako/utility';

import type TicketPlugin from '../Plugin.js';

import type { CandidateGuild, SettingFilter } from './getSharedTicketGuilds.js';

export const safeBotId = (cipher: string): string | null => {
 try {
  return getBotIdFromToken(decrypt(cipher));
 } catch {
  return null;
 }
};

export const settingsBotId = function (this: TicketPlugin, settings: TicketSetting): string | null {
 if (!settings.botToken) return this.getPluginAPI().botId;

 return safeBotId(settings.botToken);
};

export const servedBy = function (this: TicketPlugin, botId: string | undefined): SettingFilter {
 const target = botId ?? this.getPluginAPI().botId;
 return (settings) => settingsBotId.call(this, settings) === target;
};

export const findDmBotSetting = (
 candidates: CandidateGuild[],
 recipientId: string | undefined,
): { guildId: string; setting: TicketSetting } | null => {
 if (!recipientId) return null;

 for (const candidate of candidates) {
  const setting = candidate.kinds.find(
   (kind) => kind.botToken && safeBotId(kind.botToken) === recipientId,
  );
  if (setting) return { guildId: candidate.guildId, setting };
 }

 return null;
};

export const resolveDmBotApi = async function (
 this: TicketPlugin,
 candidates: CandidateGuild[],
 recipientId: string | undefined,
): Promise<API | null> {
 if (!recipientId) return this.getPluginAPI();

 const match = findDmBotSetting(candidates, recipientId);
 if (match?.setting.botToken) return this.getAPI(match.guildId, match.setting.botToken);

 return null;
};
