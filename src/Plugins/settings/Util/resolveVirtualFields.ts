import type {
 RowGuardContext,
 SettingsField,
 SettingsFieldVirtual,
 SettingsSchema,
} from '../SettingsSchema.js';

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

export const guideVirtualFields = (schema: SettingsSchema): SettingsField[] => {
 const steps = new Set(
  (schema.guide?.sections ?? []).flatMap((section) => section.steps.map((step) => step.column)),
 );

 return schema.groups.flatMap((group) =>
  group.fields.filter((field) => field.virtual && steps.has(field.column)),
 );
};
