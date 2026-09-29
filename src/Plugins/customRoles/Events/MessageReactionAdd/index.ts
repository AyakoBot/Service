import { ActivitySource } from '@ayako/database';
import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type CustomRolesPlugin from '../../Plugin.js';

export default async function (
 this: CustomRolesPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageReactionAdd>,
): Promise<void> {
 if (!data.guild_id || data.member?.user.bot) return;

 await this.activity.record(data.guild_id, data.user_id, ActivitySource.Reactions);
}
