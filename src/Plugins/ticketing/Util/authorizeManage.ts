import {
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import type TicketPlugin from '../Plugin.js';

export const authorizeManage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
): Promise<boolean> {
 if (hasManageGuild(cmd.member?.permissions)) return true;

 const t = await this.t(cmd.guild_id ?? undefined);
 new MessagePayload(this.client, { origin: this.name, reason: 'Snippet manage permission check' })
  .setContent(t.tag.errors.manageGuildRequired())
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);

 return false;
};
