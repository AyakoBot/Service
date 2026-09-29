import { ActivitySource } from '@ayako/database';
import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type CustomRolesPlugin from '../../Plugin.js';

export default async function (
 this: CustomRolesPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
): Promise<void> {
 if (!data.guild_id || data.author.bot || data.webhook_id) return;

 await this.activity.record(data.guild_id, data.author.id, ActivitySource.Messages);
}
