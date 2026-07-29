import type { API } from '@ayako/api';
import type { TicketSetting } from '@ayako/database';
import { decrypt, getBotIdFromToken } from '@ayako/utility';

import type TicketPlugin from '../Plugin.js';

import type { CandidateGuild } from './getSharedTicketGuilds.js';

const safeBotId = (cipher: string): string | null => {
 try {
  return getBotIdFromToken(decrypt(cipher));
 } catch {
  return null;
 }
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
 if (!recipientId) return this.client.getBaseAPI();

 const match = findDmBotSetting(candidates, recipientId);
 if (match?.setting.botToken) return this.getAPI(match.guildId, match.setting.botToken);

 return null;
};
