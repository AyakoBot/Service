import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type CustomRolesPlugin from '../../Plugin.js';

export default async function (
 this: CustomRolesPlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberRemove>,
): Promise<void> {
 await this.roles.onMemberLeave(data.guild_id, data.user.id);
}
