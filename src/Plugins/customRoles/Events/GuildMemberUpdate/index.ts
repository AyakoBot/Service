import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type CustomRolesPlugin from '../../Plugin.js';

export default async function (
 this: CustomRolesPlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberUpdate>,
): Promise<void> {
 await this.rewards
  .onMemberUpdate(data.guild_id, data.user.id, data.roles)
  .catch((error: Error) => this.nonFatalError(error, 'customRoles.digest'));

 await this.roles
  .stripSharedRoles(data)
  .catch((error: Error) => this.nonFatalError(error, 'customRoles.stripShared'));
}
