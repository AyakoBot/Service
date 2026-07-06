import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { GreetingKind } from '../../Classes/Enums.js';
import type WelcomePlugin from '../../Plugin.js';
import { consumePendingMarker } from '../../Util/pendingMarker.js';
import sendGreeting from '../../Util/sendGreeting.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberRemove>,
) {
 const wasPending = await consumePendingMarker.call(this, data.guild_id, data.user.id);
 if (wasPending) return;

 await sendGreeting.call(this, GreetingKind.Goodbye, data.guild_id, data.user);
}
