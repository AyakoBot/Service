import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { isUnset } from '../../Util/isUnset.js';
import persistFieldValue from '../../Util/persistFieldValue.js';
import { resolveVirtualFields } from '../../Util/resolveVirtualFields.js';

import { followUpWarning } from './followUpWarning.js';
import { notifyRowChange, reRender } from './navigator.js';

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

 const next = !displayRow[field.column];

 if (field.headerToggle && next) {
  const toggledGroup = schema.groups.find((g) => g.id === id.groupId);
  const missing = (toggledGroup ? [toggledGroup] : schema.groups)
   .filter((g) => !g.showIf || g.showIf(row).ok)
   .flatMap((g) => g.fields)
   .filter((f) => f.required && (!f.showIf || f.showIf(row).ok) && isUnset(row[f.column]));

  if (missing.length) {
   const t = await this.t(cmd.guild_id);
   await reRender.call(this, cmd, id);
   await followUpWarning.call(
    this,
    cmd,
    t.navigator.activateBlocked({
     fields: missing.map((f) => `\`${f.label}\``).join(', '),
    }),
   );
   return;
  }
 }

 let persisted: unknown = next;
 if (field.transform) {
  const result = await field.transform(next, {
   client: this.client,
   plugin: resolved.plugin,
   guildId: cmd.guild_id,
   rowId: id.rowId,
  });

  if ('error' in result) {
   const t = await this.t(cmd.guild_id);
   await reRender.call(this, cmd, id);
   await followUpWarning.call(
    this,
    cmd,
    t.navigator.validationFailed({ field: field.label, reason: result.error }),
   );
   return;
  }

  persisted = result.value;
 }

 const written = await persistFieldValue.call(this, {
  field,
  value: persisted,
  row,
  table: resolved.schema.table,
  rowId: id.rowId,
  guildId: cmd.guild_id,
  owner: resolved.plugin,
 });

 if (!written.ok) {
  const t = await this.t(cmd.guild_id);
  await reRender.call(this, cmd, id);
  await followUpWarning.call(
   this,
   cmd,
   t.navigator.validationFailed({ field: field.label, reason: written.reason ?? '' }),
  );
  return;
 }

 await reRender.call(this, cmd, id);
 await notifyRowChange.call(this, resolved, cmd.guild_id, id.rowId);
}
