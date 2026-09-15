import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import { activateBlockers } from '../../Util/activateBlockers.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

import { followUpWarning } from './followUpWarning.js';
import { notifyRowChange, overviewPage } from './navigator.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
): Promise<void> {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.StringSelect) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const column = schema.groups.flatMap((g) => g.fields).find((f) => f.headerToggle)?.column;
 if (!column) return;

 const table = this.tableClient(resolved.schema.table);
 const rows = await table.findMany({
  where: { guild: cmd.guild_id, [resolved.schema.rowKey]: { in: cmd.data.values } },
 });

 const ready = rows.filter((row) => !activateBlockers(schema, row, column).length);

 await Promise.all(
  ready.map((row) =>
   table.updateMany({
    where: { [resolved.schema.rowKey]: row[resolved.schema.rowKey], guild: cmd.guild_id },
    data: { [column]: true },
   }),
  ),
 );

 await overviewPage.call(this, cmd, id);

 for (const row of ready) {
  await notifyRowChange.call(this, resolved, cmd.guild_id, String(row[resolved.schema.rowKey]));
 }

 const skipped = rows.length - ready.length;
 const t = await this.t(cmd.guild_id);

 if (skipped) {
  await followUpWarning.call(this, cmd, t.navigator.activateSkipped({ count: String(skipped) }));
 }
}
