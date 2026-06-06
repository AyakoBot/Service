import { TicketState } from '@ayako/database';
import { MessageFlags, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';
import { resolveSchema } from '../../Util/resolveSchema.js';
import { tableClient } from '../../Util/tableClient.js';

import { reRender } from './navigator.js';

export const del = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;
 if (!resolved.schema.multiRow) return;

 const row = await tableClient(this.client, resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const open = await this.client.db.client.ticket.findMany({
  where: {
   settingsId: id.rowId,
   state: { in: [TicketState.opened, TicketState.claimed] },
  },
 });

 if (open.length) {
  const t = await this.t(cmd.guild_id);
  new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete blocked' })
   .setContent(t.navigator.deleteBlocked({ count: String(open.length) }))
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 await tableClient(this.client, resolved.schema.table).deleteMany({
  where: { id: id.rowId, guild: cmd.guild_id },
 });

 reRender.call(this, cmd, { ...id, rowId: undefined });
};
