import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type WelcomePlugin from '../../Plugin.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.ChannelDelete>,
) {
 await this.client.db.client.welcomeGif.deleteMany({ where: { channel: data.id } });
}
