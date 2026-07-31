import type Plugin from '../../../Classes/abstracts/Plugin.js';
import type { TableName } from '../../../Types/prisma.js';
import type SettingsPlugin from '../Plugin.js';
import type { SettingsField, ShowIfResult } from '../SettingsSchema.js';

export default async function (
 this: SettingsPlugin,
 args: {
  field: SettingsField;
  value: unknown;
  row: Record<string, unknown>;
  table: TableName;
  rowId: string;
  guildId: string;
  owner: Plugin;
 },
): Promise<ShowIfResult> {
 if (args.field.virtual) {
  try {
   return await args.field.virtual.write(args.value, args.row, {
    client: this.client,
    plugin: args.owner,
    guildId: args.guildId,
   });
  } catch {
   return { ok: false };
  }
 }

 await this.tableClient(args.table).updateMany({
  where: { id: args.rowId, guild: args.guildId },
  data: { [args.field.column]: args.value },
 });

 return { ok: true };
}
