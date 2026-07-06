import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type TicketPlugin from '../../Plugin.js';
import {
 buildEndPayload,
 buildKindSelectPayload,
 buildServerSelectPayload,
} from '../../Util/buildIntakePayload.js';
import getOpenableKinds from '../../Util/getOpenableKinds.js';
import getSharedTicketGuilds from '../../Util/getSharedTicketGuilds.js';

import { startKind } from './intakeKind.js';

export default async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 if (cmd.guild_id) return;

 const userId = cmd.user?.id || cmd.member?.user.id;
 if (!userId) return;

 const candidates = await getSharedTicketGuilds.call(this.client, userId);

 if (!candidates.length) {
  const t = await this.t(undefined);
  (await buildEndPayload.call(this, t.intake.noServers())).update(cmd);
  return;
 }

 if (candidates.length === 1) {
  const [{ guildId }] = candidates;
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
  return;
 }

 (await buildServerSelectPayload.call(this, candidates)).update(cmd);
}
