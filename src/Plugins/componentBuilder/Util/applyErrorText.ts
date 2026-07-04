import type ComponentBuilderPlugin from '../Plugin.js';

import { BuilderErrorCode } from './componentTree.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

export const applyErrorText = (t: Translator, code: BuilderErrorCode): string => {
 const texts: Record<BuilderErrorCode, () => string> = {
  [BuilderErrorCode.TooManyComponents]: t.errors.tooManyComponents,
  [BuilderErrorCode.RowFull]: t.errors.rowFull,
  [BuilderErrorCode.SectionFull]: t.errors.sectionFull,
  [BuilderErrorCode.SectionNeedsText]: t.errors.sectionNeedsText,
  [BuilderErrorCode.GalleryItemCount]: t.errors.galleryItemCount,
  [BuilderErrorCode.SelectOptionCount]: t.errors.selectOptionCount,
  [BuilderErrorCode.CustomIdPrefix]: t.errors.customIdPrefix,
  [BuilderErrorCode.CustomIdTaken]: t.errors.customIdTaken,
  [BuilderErrorCode.InvalidUrl]: t.errors.invalidUrl,
  [BuilderErrorCode.InvalidColor]: t.base.errors.invalidColor,
  [BuilderErrorCode.InvalidNumber]: t.errors.invalidNumber,
  [BuilderErrorCode.MinOverMax]: t.errors.minOverMax,
  [BuilderErrorCode.EmptyContent]: t.errors.emptyContent,
  [BuilderErrorCode.TooLong]: t.errors.tooLong,
  [BuilderErrorCode.TooMuchText]: t.errors.tooMuchText,
  [BuilderErrorCode.UnsupportedComponent]: t.errors.unsupportedComponent,
  [BuilderErrorCode.NotAllowedHere]: t.errors.notAllowedHere,
 };
 return texts[code]();
};
