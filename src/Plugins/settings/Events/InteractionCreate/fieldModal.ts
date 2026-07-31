import { RequestHandlerError } from '@ayako/api';
import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import { buildFieldModal } from '../../Util/buildFieldModal.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveVirtualFields } from '../../Util/resolveVirtualFields.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId || !id.column) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const field = schema.groups.flatMap((g) => g.fields).find((f) => f.column === id.column);
 if (!field) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const displayRow = {
  ...row,
  ...(await resolveVirtualFields([field], row, {
   client: this.client,
   plugin: resolved.plugin,
   guildId: cmd.guild_id,
  })),
 };

 const modal = buildFieldModal(
  id.settingName,
  id.rowId,
  id.groupId,
  field,
  displayRow,
  Boolean(id.hideUnavail),
  id.guideFlags,
  id.guideSection,
 );

 const api = await this.getAPI(cmd.guild_id);
 const res = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Editing a settings field',
 });

 if (res instanceof RequestHandlerError) {
  this.nonFatalError(
   new Error('Failed to open the settings field modal', { cause: res }),
   'fieldModal',
  );
 }
}
