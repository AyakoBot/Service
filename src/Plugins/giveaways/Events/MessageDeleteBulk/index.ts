import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type GiveawaysPlugin from '../../Plugin.js';

export default async function (
 this: GiveawaysPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageDeleteBulk>,
) {
 await this.engine.cancelDeleted({ message: { in: data.ids } });
}
