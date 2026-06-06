import type { DefaultTranslator, SettingsSchema, SettingsSchemaDef } from '../SettingsSchema.js';

export const globalSchemaTranslator = (
 t: DefaultTranslator,
 def: SettingsSchemaDef,
): SettingsSchema => ({
 table: def.table,
 rowKey: def.rowKey,
 multiRow: def.multiRow,
 rowLabel: (row) => def.rowLabel(t, row),
 groups: def.groups.map((g) => ({
  id: g.id,
  label: g.label(t),
  description: g.description?.(t),
  showIf: g.showIf,
  fields: g.fields.map((f) => ({
   column: f.column,
   editor: f.editor,
   label: f.label(t),
   description: f.description?.(t),
   arity: f.arity,
   options: Array.isArray(f.options)
    ? f.options.map((o) => ({ value: o.value, label: o.label(t) }))
    : f.options,
   required: f.required,
   secret: f.secret,
   headerToggle: f.headerToggle,
   showIf: f.showIf,
   validate: f.validate,
  })),
 })),
});
