import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type TicketPlugin from '../../Plugin.js';
import { buildEndPayload, buildKindSelectPayload } from '../../Util/buildIntakePayload.js';
import getOpenableKinds from '../../Util/getOpenableKinds.js';

import { startKind } from './intakeKind.js';

export const intakeServer = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 _args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (cmd.guild_id) return;

 const userId = cmd.user?.id || cmd.member?.user.id;
 if (!userId) return;

 const [guildId] = cmd.data.values;
 const member = await this.client.cache.members.get(guildId, userId);
 const kinds = await getOpenableKinds.call(this.client, guildId, userId, member?.roles ?? []);

 if (!kinds.length) {
  const t = await this.t(guildId);
  (await buildEndPayload.call(this, t.intake.noKinds())).update(cmd);
  return;
 }

 if (kinds.length === 1) {
  const [only] = kinds;
  await startKind.call(this, cmd, guildId, userId, only);
  return;
 }

 (await buildKindSelectPayload.call(this, guildId, kinds)).update(cmd);
};
