import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../types/gateway.js';
import type AFKPlugin from '../../Plugin.js';

import afk from './afk.js';

export default async function (
 this: AFKPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 afk.call(this, cmd);
}
