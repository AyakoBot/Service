import type { RMessage } from '@ayako/utility';

import { getCensoredContent } from '../../../Util/censorContent.js';
import type AFKPlugin from '../Plugin.js';

import { previewOf } from './text.js';

export const pingPreview = async function (this: AFKPlugin, msg: RMessage): Promise<string> {
 if (!msg.content) return '';

 const author = await this.client.cache.members.get(msg.guild_id, msg.author_id);
 const censored = await getCensoredContent.call(
  this,
  msg.guild_id,
  msg.content,
  msg.channel_id,
  author?.roles ?? [],
 );

 return previewOf(censored);
};
