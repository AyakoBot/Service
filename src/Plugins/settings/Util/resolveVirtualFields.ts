import type { RowGuardContext, SettingsField, SettingsFieldVirtual } from '../SettingsSchema.js';

const readTimeoutMs = 2000;

const withTimeout = async (read: Promise<unknown>): Promise<unknown> => {
 let timer: NodeJS.Timeout | undefined;
 const guard = new Promise<null>((resolve) => {
  timer = setTimeout(() => resolve(null), readTimeoutMs);
 });

 try {
  return await Promise.race([read, guard]);
 } finally {
  clearTimeout(timer);
 }
};

export const resolveVirtualFields = async (
 fields: SettingsField[],
 row: Record<string, unknown>,
 ctx: RowGuardContext,
): Promise<Record<string, unknown>> => {
 const virtual = fields.flatMap(
  (field): { column: string; virtual: SettingsFieldVirtual }[] =>
   (field.virtual ? [{ column: field.column, virtual: field.virtual }] : []),
 );
 if (!virtual.length) return {};

 const entries = await Promise.all(
  virtual.map(async (entry): Promise<readonly [string, unknown]> => {
   try {
    return [entry.column, await withTimeout(entry.virtual.read(row, ctx))];
   } catch {
    return [entry.column, null];
   }
  }),
 );

 return Object.fromEntries(entries);
};
