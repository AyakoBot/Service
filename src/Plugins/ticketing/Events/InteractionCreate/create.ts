import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import handleTicketError from '../../Util/handleTicketError.js';
import startTicketCreate from '../../Util/startTicketCreate.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild || !cmd.guild_id) return;

 const user = cmd.user || cmd.member?.user;

 if (!user) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.userNotFound, { cause: user }),
   cmd,
  });
  return;
 }

 if (!cmd.member) {
  const t = await this.t(cmd.guild_id || cmd.guild?.id);

  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(t.base.errors.memberNotFound(), { cause: user }),
   cmd,
  });
  return;
 }

 const ticketSettings = await this.client.db.client.ticketSetting.findUnique({
  where: { id: args[0] },
 });

 if (!ticketSettings) {
  const t = await this.t(cmd.guild_id || cmd.guild?.id);

  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(t.errors[BaseTicketErrors.create_SettingsNotFound](), { cause: args[0] }),
   cmd,
  });
  return;
 }

 startTicketCreate.call(this, cmd, {
  guildId: (cmd.guild?.id || cmd.guild_id)!,
  settingsId: args[0],
  type: ticketSettings.type,
  userId: user.id,
  roleIds: cmd.member.roles,
  username: user.username,
 });
}
