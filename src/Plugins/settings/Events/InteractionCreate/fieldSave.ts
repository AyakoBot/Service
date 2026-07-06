import { type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { parseDurationSeconds } from '../../../../Util/durationSeconds.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { EditorType } from '../../EditorType.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsField } from '../../SettingsSchema.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

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
 if (raw === undefined) return undefined;
 return raw === '' ? null : raw;
};

export default async function (
 this: SettingsPlugin,
 cmd: APIModalSubmitInteraction,
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

 const raw = findModalValue(cmd.data.components, field.column);

 let value: unknown;
 if (field.editor === EditorType.Duration) {
  const seconds = parseDurationSeconds(raw ?? '');
  if (seconds === null) {
   const t = await this.t(cmd.guild_id);
   await reRender.call(this, cmd, id);
   await followUpWarning.call(this, cmd, t.base.errors.invalidDuration());
   return;
  }
  value = seconds;
 } else if (field.editor === EditorType.Number && raw !== undefined && raw !== '') {
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
   const t = await this.t(cmd.guild_id);
   await reRender.call(this, cmd, id);
   await followUpWarning.call(this, cmd, t.base.errors.invalidNumber());
   return;
  }
  value = parsed;
 } else if (field.editor === EditorType.Number) {
  value = null;
 } else {
  value = readValue(field, raw);
 }

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

 let persisted = value;
 if (field.transform && value !== undefined && value !== null) {
  const result = await field.transform(value, {
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

 await this.tableClient(resolved.schema.table).updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: { [field.column]: persisted },
 });

 await reRender.call(this, cmd, id);
}
