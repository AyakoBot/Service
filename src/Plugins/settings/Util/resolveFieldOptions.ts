import type {
 OptionsResolver,
 RowGuardContext,
 SettingsField,
 SettingsOption,
} from '../SettingsSchema.js';

const resolveTimeoutMs = 2000;

const withTimeout = async (
 options: Promise<SettingsOption[]>,
): Promise<SettingsOption[] | null> => {
 let timer: NodeJS.Timeout | undefined;
 const guard = new Promise<null>((resolve) => {
  timer = setTimeout(() => resolve(null), resolveTimeoutMs);
 });

 try {
  return await Promise.race([options, guard]);
 } finally {
  clearTimeout(timer);
 }
};

export const resolveFieldOptions = async (
 fields: SettingsField[],
 ctx: RowGuardContext,
): Promise<SettingsField[]> => {
 const dynamic = fields.filter((field) => typeof field.options === 'function');
 if (!dynamic.length) return fields;

 const resolved = new Map<string, SettingsField['options']>();

 await Promise.all(
  dynamic.map(async (field) => {
   const options = await withTimeout((field.options as OptionsResolver)(ctx)).catch(() => null);

   resolved.set(field.column, Array.isArray(options) ? options : []);
  }),
 );

 return fields.map((field) =>
  resolved.has(field.column) ? { ...field, options: resolved.get(field.column) } : field,
 );
};
