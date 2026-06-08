import { MessageFlags, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';

import { reRender } from './navigator.js';

export const del = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;
 if (!resolved.schema.multiRow) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const guard = await resolved.schema.canDelete?.(row, {
  client: this.client,
  plugin: resolved.plugin,
  guildId: cmd.guild_id,
 });

 if (guard && !guard.ok) {
  const t = await this.t(cmd.guild_id);
  new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete blocked' })
   .setContent(guard.reason ?? t.base.errors.unknownError())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 await this.tableClient(resolved.schema.table).deleteMany({
  where: { id: id.rowId, guild: cmd.guild_id },
 });

 reRender.call(this, cmd, { ...id, rowId: undefined });
};
