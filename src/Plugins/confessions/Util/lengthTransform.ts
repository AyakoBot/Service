import type { FieldTransform } from '../../settings/SettingsSchema.js';

import { contentLimit } from './gates.js';

export enum LengthColumn {
 Min = 'minLength',
 Max = 'maxLength',
}

export interface LengthErrors {
 range: string;
 order: string;
}

export const lengthTransform =
 (column: LengthColumn, errors: LengthErrors): FieldTransform =>
 async (value, ctx) => {
  const length = Number(value);
  if (!Number.isInteger(length) || length < 1 || length > contentLimit) {
   return { error: errors.range };
  }

  const row = await ctx.client.db.client.confessionSetting.findUnique({ where: { id: ctx.rowId } });
  const min = column === LengthColumn.Min ? length : (row?.minLength ?? 1);
  const max = column === LengthColumn.Max ? length : (row?.maxLength ?? contentLimit);

  return min > max ? { error: errors.order } : { value: length };
 };
