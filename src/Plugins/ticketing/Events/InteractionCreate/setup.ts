import { MessageFlags, type APIApplicationCommandInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import TicketPanel from '../../Classes/TicketPanel.js';
import type TicketPlugin from '../../Plugin.js';

import { buildPanelEditor } from './panelEditor.js';

export default async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);

 if (!hasManageGuild(cmd.member?.permissions)) {
  new MessagePayload(this.client, { origin: this.name, reason: 'Panel editor permission check' })
   .setContent(t.tag.errors.manageGuildRequired())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 const panels = await TicketPanel.all(this.client, cmd.guild_id);
 const payload = await buildPanelEditor.call(this, cmd.guild_id, panels, 0);
 payload.reply(cmd);
}
