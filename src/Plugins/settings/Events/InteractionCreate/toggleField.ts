import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

import { followUpWarning } from './followUpWarning.js';
import { reRender } from './navigator.js';

const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId || !id.column) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const group = schema.groups.find((g) => g.id === id.groupId);
 const field = group?.fields.find((f) => f.column === id.column);
 if (!field) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const next = !row[field.column];

 if (field.headerToggle && next) {
  const missing = schema.groups
   .flatMap((g) => g.fields)
   .find((f) => f.required && isUnset(row[f.column]));

  if (missing) {
   const t = await this.t(cmd.guild_id);
   await reRender.call(this, cmd, id);
   await followUpWarning.call(this, cmd, t.navigator.activateBlocked({ field: missing.label }));
   return;
  }
 }

 await this.tableClient(resolved.schema.table).updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: { [field.column]: next },
 });

 await reRender.call(this, cmd, id);
}
