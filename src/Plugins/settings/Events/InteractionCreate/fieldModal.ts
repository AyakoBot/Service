import { RequestHandlerError } from '@ayako/api';
import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { FieldArity } from '../../SettingsSchema.js';
import { buildFieldModal } from '../../Util/buildFieldModal.js';
import { optionKinds, resolveComponentKind } from '../../Util/resolveComponentKind.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveFieldOptions } from '../../Util/resolveFieldOptions.js';
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
 const raw = schema.groups.flatMap((g) => g.fields).find((f) => f.column === id.column);
 if (!raw) return;

 const ctx = { client: this.client, plugin: resolved.plugin, guildId: cmd.guild_id };
 const [field] = await resolveFieldOptions([raw], ctx);
 if (!field) return;

 const kind = resolveComponentKind(field.editor, field.arity ?? FieldArity.Single, 0);
 if (optionKinds.has(kind) && Array.isArray(field.options) && !field.options.length) {
  const t = await this.t(cmd.guild_id);

  ephemeralNote.call(this, cmd, t.navigator.noOptions());
  return;
 }

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const displayRow = {
  ...row,
  ...(await resolveVirtualFields([field], row, ctx)),
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
