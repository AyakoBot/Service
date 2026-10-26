import type { SettingsField, TransformContext, TransformResult } from '../SettingsSchema.js';

export const applyFieldTransform = (
 field: SettingsField,
 value: unknown,
 ctx: TransformContext,
): Promise<TransformResult> =>
 field.transform && value !== undefined && value !== null
  ? field.transform(value, ctx)
  : Promise.resolve({ value });
