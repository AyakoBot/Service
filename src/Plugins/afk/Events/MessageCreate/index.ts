import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import getPrefix from '../../../../Util/getPrefix.js';
import type AFKPlugin from '../../Plugin.js';

import afk from './afk.js';
import mention from './mention.js';
import self from './self.js';

export default async function (
 this: AFKPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 const msg = this.client.cache.messages.apiToR(data, data.guild_id || '@me');

 if (!msg.author_id) return;
 if (data.author.bot) return;

 const prefix = await getPrefix.call(this.client, msg);
 const commandName = prefix ? msg.content.slice(prefix.length).split(/\s+/)[0] : null;
 const t = await this.t(msg.guild_id || undefined);

 self.call(this, msg, commandName, t);
 mention.call(this, msg, commandName, t);
 afk.call(this, msg, commandName, prefix);
}
