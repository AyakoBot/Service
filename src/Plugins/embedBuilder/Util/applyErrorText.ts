import type EmbedBuilderPlugin from '../Plugin.js';

import { ApplyErrorCode } from './applyProperty.js';

type Translator = Awaited<ReturnType<EmbedBuilderPlugin['t']>>;

export const applyErrorText = (t: Translator, code: ApplyErrorCode): string => {
 const texts: Record<ApplyErrorCode, () => string> = {
  [ApplyErrorCode.InvalidColor]: t.base.errors.invalidColor,
  [ApplyErrorCode.InvalidTimestamp]: t.errors.invalidTimestamp,
  [ApplyErrorCode.InvalidUrl]: t.errors.invalidUrl,
  [ApplyErrorCode.NoFieldSelected]: t.errors.noFieldSelected,
 };
 return texts[code]();
};
