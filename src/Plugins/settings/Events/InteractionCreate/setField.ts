import { type APIMessageComponentSelectMenuInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import { FieldArity } from '../../SettingsSchema.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

import { followUpWarning } from './followUpWarning.js';
import { reRender } from './navigator.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentSelectMenuInteraction,
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

 const { values } = cmd.data;
 const multi = field.arity === FieldArity.Multi;
 const value: unknown = multi ? values : (values[0] ?? null);

 const validation = field.validate?.(value, row);
 if (validation && !validation.ok) {
  const t = await this.t(cmd.guild_id);
  await reRender.call(this, cmd, id);
  await followUpWarning.call(
   this,
   cmd,
   t.navigator.validationFailed({ field: field.label, reason: validation.reason ?? '' }),
  );
  return;
 }

 await this.tableClient(resolved.schema.table).updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: { [field.column]: value },
 });

 await reRender.call(this, cmd, id);
}
