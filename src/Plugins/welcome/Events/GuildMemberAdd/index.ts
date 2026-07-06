import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { GreetingKind } from '../../Classes/Enums.js';
import type WelcomePlugin from '../../Plugin.js';
import { setPendingMarker } from '../../Util/pendingMarker.js';
import sendGreeting from '../../Util/sendGreeting.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberAdd>,
) {
 if (!data.user) return;

 if (data.pending) {
  await setPendingMarker.call(this, data.guild_id, data.user.id);
  return;
 }

 await sendGreeting.call(this, GreetingKind.Welcome, data.guild_id, data.user);
}
