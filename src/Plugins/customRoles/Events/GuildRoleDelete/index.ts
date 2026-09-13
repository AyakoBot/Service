import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type CustomRolesPlugin from '../../Plugin.js';

export default async function (
 this: CustomRolesPlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildRoleDelete>,
): Promise<void> {
 await this.roles.onRoleDeleted(data.guild_id, data.role_id);

 if (!(await this.rewards.pruneRole(data.guild_id, data.role_id))) return;

 await this.rewards.enqueueReconcile(data.guild_id);
}
