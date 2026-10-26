import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import handleTicketError from '../../Util/handleTicketError.js';
import openCreateModal from '../../Util/openCreateModal.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 _args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (!cmd.guild || !cmd.guild_id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user || !cmd.member) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.memberNotFound, { cause: user }),
   cmd,
  });
  return;
 }

 const [settingsId] = cmd.data.values;

 const ticketSettings = await this.client.db.client.ticketSetting.findUnique({
  where: { id: settingsId },
 });

 if (!ticketSettings || ticketSettings.guild !== cmd.guild_id) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.create_SettingsNotFound, { cause: settingsId }),
   cmd,
  });
  return;
 }

 await openCreateModal.call(this, cmd, ticketSettings, {
  userId: user.id,
  roleIds: cmd.member.roles,
 });
}
