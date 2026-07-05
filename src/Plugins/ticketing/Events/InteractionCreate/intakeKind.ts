import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import { buildEndPayload, buildExistingPayload } from '../../Util/buildIntakePayload.js';
import getOpenableKinds, { type OpenableKind } from '../../Util/getOpenableKinds.js';
import isUnderLimit from '../../Util/isUnderLimit.js';
import startTicketCreate from '../../Util/startTicketCreate.js';

export const startKind = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 guildId: string,
 userId: string,
 kind: OpenableKind,
) {
 const limit = await isUnderLimit.call(this.client, kind.settings, userId);
 if (!limit.ok) {
  (await buildExistingPayload.call(this, guildId, limit.ticketId)).update(cmd);
  return;
 }

 const member = await this.client.cache.members.get(guildId, userId);
 const user = await this.client.cache.users.get(userId);

 startTicketCreate.call(this, cmd, {
  guildId,
  settingsId: String(kind.settings.id),
  type: kind.settings.type,
  userId,
  roleIds: member?.roles ?? [],
  username: user?.username || userId,
 });
};

export const intakeKind = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (cmd.guild_id) return;

 const userId = cmd.user?.id || cmd.member?.user.id;
 if (!userId) return;

 const [guildId] = args;
 const [settingsId] = cmd.data.values;

 const member = await this.client.cache.members.get(guildId, userId);
 const kinds = await getOpenableKinds.call(this.client, guildId, userId, member?.roles ?? []);
 const kind = kinds.find((k) => String(k.settings.id) === settingsId);

 if (!kind) {
  const t = await this.t(guildId);
  (await buildEndPayload.call(this, t.errors[BaseTicketErrors.create_SettingsNotFound]())).update(
   cmd,
  );
  return;
 }

 await startKind.call(this, cmd, guildId, userId, kind);
};
