import { RequestHandlerError } from '@ayako/api';
import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { origin } from '../../Classes/Routes.js';
import Verification from '../../Classes/Verification.js';
import type VerificationPlugin from '../../Plugin.js';

export default async function (
 this: VerificationPlugin,
 data: ExtractPayload<GatewayDispatchEvents.GuildMemberAdd>,
) {
 if (!data.user) return;

 const verification = await Verification.fetch(this, data.guild_id);
 if (!verification) return;

 const { pendingRole, kick, kickAfter } = verification.settings;
 if (!pendingRole) return;

 const t = await this.t(data.guild_id);
 const api = await this.getAPI(data.guild_id);

 const res = await api.guilds.addRoleToMember(data.guild_id, data.user.id, pendingRole, {
  origin,
  reason: t.log.started(),
 });
 if (res instanceof RequestHandlerError) this.nonFatalError(res, 'pending role');

 if (kick && Number(kickAfter) > 0 && !data.user.bot) {
  await this.kicks.arm(data.guild_id, data.user.id, Number(kickAfter));
 }
}
