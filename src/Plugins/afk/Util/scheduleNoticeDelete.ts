import { RequestHandlerError } from '@ayako/api';
import { getPathFromError, type RMessage } from '@ayako/utility';
import type { APIMessage } from 'discord-api-types/v10';

import type AFKPlugin from '../Plugin.js';

const noticeLifetimeMs = 10000;

export const scheduleNoticeDelete = function (
 this: AFKPlugin,
 notice: APIMessage | RMessage | undefined,
 guildId: string,
 reason: string,
 lifetimeMs = noticeLifetimeMs,
) {
 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + lifetimeMs),
  async () => {
   if (!notice) return;

   const res = await (await this.getAPI(guildId)).channels.deleteMessage(
    notice.channel_id,
    notice.id,
    { reason, origin: this.name },
   );
   if (res instanceof RequestHandlerError) this.nonFatalError(res, 'scheduleNoticeDelete');
  },
 );
};
