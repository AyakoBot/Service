import { MessageFlags, type APIApplicationCommandInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../../Plugin.js';

export default async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);

 const setting = await this.client.db.client.ticketSetting
  .create({
   data: {
    id: String(Date.now()),
    guild: cmd.guild_id,
    active: false,
   },
  })
  .catch((error: Error) => error);

 if (setting instanceof Error) {
  this.nonFatalError(setting, 'ticketSetup');

  new MessagePayload(this.client, { origin: this.name, reason: 'Creating ticket system' })
   .setContent(t.base.errors.unknownError())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 new MessagePayload(this.client, { origin: this.name, reason: 'Creating ticket system' })
  .setContent(t.setupCreated())
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
}
