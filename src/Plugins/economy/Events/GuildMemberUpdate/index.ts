import type { GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type EconomyPlugin from '../../Plugin.js';

export default async function (
 this: EconomyPlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberUpdate>,
): Promise<void> {
 if (!data.guild_id || !data.user?.id) return;

 const settings = await this.bank.settings(data.guild_id);
 if (!settings.active || settings.frozen) return;

 await this.rewards.reconcileMember(data.guild_id, data.user.id, data.roles ?? []);
}
