import type { API } from '@ayako/api';
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

export const resolveDmBotApi = async function (
 this: TicketPlugin,
 candidates: CandidateGuild[],
 recipientId: string | undefined,
): Promise<API | null> {
 if (!recipientId) return this.client.getBaseAPI();

 for (const candidate of candidates) {
  const setting = candidate.kinds.find(
   (kind) => kind.botToken && safeBotId(kind.botToken) === recipientId,
  );
  if (setting?.botToken) return this.getAPI(candidate.guildId, setting.botToken);
 }

 return null;
};
