import { type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { EditorType } from '../../EditorType.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsField } from '../../SettingsSchema.js';
import type { SettingsId } from '../../Util/customId.js';
import { findModalValue } from '../../Util/findModalValue.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';
import { tableClient } from '../../Util/tableClient.js';

import { followUpWarning } from './followUpWarning.js';
import { reRender } from './navigator.js';

const readValue = (field: SettingsField, raw: string | undefined): unknown => {
 if (field.secret) return raw === undefined || raw === '' ? undefined : raw;
 if (field.editor === EditorType.Strings) {
  if (raw === undefined) return undefined;
  return raw
   .split('\n')
   .map((line) => line.trim())
   .filter((line) => line.length > 0);
 }
 if (field.editor === EditorType.Number) {
  return raw === undefined || raw === '' ? null : Number(raw);
 }
 if (raw === undefined) return undefined;
 return raw === '' ? null : raw;
};

export default async function (
 this: SettingsPlugin,
 cmd: APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId || !id.column) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const group = schema.groups.find((g) => g.id === id.groupId);
 const field = group?.fields.find((f) => f.column === id.column);
 if (!field) return;

 const row = await tableClient(this.client, resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const raw = findModalValue(cmd.data.components, field.column);
 const value = readValue(field, raw);

 if (field.secret && value === undefined) {
  await reRender.call(this, cmd, id);
  return;
 }

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

 await tableClient(this.client, resolved.schema.table).updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: { [field.column]: value },
 });

 await reRender.call(this, cmd, id);
}
