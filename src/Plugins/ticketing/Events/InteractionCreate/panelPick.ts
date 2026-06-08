import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassBySettingsType from '../../Util/getTicketClassBySettingsType.js';
import handleTicketError from '../../Util/handleTicketError.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 _args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (!cmd.guild || !cmd.guild_id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user || !cmd.member) {
  const t = await this.t(cmd.guild_id || cmd.guild?.id);
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(t.base.errors.memberNotFound(), { cause: user }),
   cmd,
  });
  return;
 }

 const [settingsId] = cmd.data.values;

 const ticketSettings = await this.client.db.client.ticketSetting.findUnique({
  where: { id: settingsId },
 });

 if (!ticketSettings || ticketSettings.guild !== cmd.guild_id) {
  const t = await this.t(cmd.guild_id || cmd.guild?.id);
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(t.errors[BaseTicketErrors.create_SettingsNotFound](), { cause: settingsId }),
   cmd,
  });
  return;
 }

 const ticket = getTicketClassBySettingsType.call(this.client, ticketSettings.type, '0');
 const create = ticket.create(
  { settingsId, userId: user.id },
  { cmd, userId: user.id, roleIds: cmd.member.roles, username: user.username },
 );
 create.next().catch((e: Error) =>
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: e,
   cmd,
  }),
 );
}
