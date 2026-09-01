import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type WelcomePlugin from '../../Plugin.js';
import { involuntaryActions, markInvoluntary } from '../../Util/leave.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildAuditLogEntryCreate>,
) {
 if (!data.target_id) return;
 if (!involuntaryActions.includes(data.action_type)) return;

 await markInvoluntary.call(this, data.guild_id, data.target_id);
}
