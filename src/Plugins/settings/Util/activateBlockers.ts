import type { SettingsField, SettingsSchema } from '../SettingsSchema.js';

import { isUnset } from './isUnset.js';

export const activateBlockers = (
 schema: SettingsSchema,
 row: Record<string, unknown>,
 column: string,
): SettingsField[] => {
 const gated = schema.groups.filter((g) => g.fields.some((f) => f.headerToggle)).map((g) => g.id);
 const owner = schema.groups.find((g) => g.fields.some((f) => f.column === column));

 return schema.groups
  .filter((g) => g.id === owner?.id || !gated.includes(g.id))
  .filter((g) => !g.showIf || g.showIf(row).ok)
  .flatMap((g) => g.fields)
  .filter((f) => f.required && (!f.showIf || f.showIf(row).ok) && isUnset(row[f.column]));
};
