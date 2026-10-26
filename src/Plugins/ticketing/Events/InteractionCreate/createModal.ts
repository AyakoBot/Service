import { type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';
import { openingTextField } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';
import handleTicketError from '../../Util/handleTicketError.js';
import startTicketCreate from '../../Util/startTicketCreate.js';

export default async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const guildId = cmd.guild_id;
 const user = cmd.member?.user;
 const fail = (error: Error) => handleTicketError.call(this.client, { guildId, error, cmd });

 if (!user || !cmd.member) {
  fail(new Error(BaseTicketErrors.memberNotFound, { cause: user }));
  return;
 }

 const text = findModalValue(cmd.data.components, openingTextField)?.trim();
 if (!text) {
  fail(new Error(BaseTicketErrors.create_EmptyText));
  return;
 }

 const settings = args[0]
  ? await this.client.db.client.ticketSetting.findFirst({ where: { id: args[0], guild: guildId } })
  : null;

 if (!settings) {
  fail(new Error(BaseTicketErrors.create_SettingsNotFound, { cause: args[0] }));
  return;
 }

 startTicketCreate.call(this, cmd, {
  guildId,
  settingsId: args[0],
  type: settings.type,
  userId: user.id,
  roleIds: cmd.member.roles,
  username: user.username,
  text,
 });
}
