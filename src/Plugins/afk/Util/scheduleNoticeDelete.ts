import { getPathFromError, type RMessage } from '@ayako/utility';
import type { APIMessage } from 'discord-api-types/v10';

import type AFKPlugin from '../Plugin.js';

const noticeLifetimeMs = 10000;

export const scheduleNoticeDelete = function (
 this: AFKPlugin,
 notice: APIMessage | RMessage | undefined,
 guildId: string,
 reason: string,
) {
 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + noticeLifetimeMs),
  async () => {
   if (!notice) return;

   (await this.getAPI(guildId)).channels.deleteMessage(notice.channel_id, notice.id, {
    reason,
    origin: this.name,
   });
  },
 );
};
