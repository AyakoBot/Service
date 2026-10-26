import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type GiveawaysPlugin from '../../Plugin.js';

type Deleted =
 | ExtractPayload<GatewayDispatchEvents.ChannelDelete>
 | ExtractPayload<GatewayDispatchEvents.ThreadDelete>;

export default async function (this: GiveawaysPlugin, data: Deleted) {
 await this.engine.cancelDeleted({ channel: data.id });
}
