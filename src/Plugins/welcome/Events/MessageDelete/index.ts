import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type WelcomePlugin from '../../Plugin.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
) {
 await this.client.db.client.welcomeGif.deleteMany({ where: { message: data.id } });
}
