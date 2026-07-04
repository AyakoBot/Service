import { ComponentType, MessageFlags } from 'discord-api-types/v10';

export enum MessageJsonKind {
 Embeds = 'embeds',
 ComponentsV2 = 'componentsV2',
 Unknown = 'unknown',
}

const v2Types: number[] = [
 ComponentType.Section,
 ComponentType.TextDisplay,
 ComponentType.Thumbnail,
 ComponentType.MediaGallery,
 ComponentType.File,
 ComponentType.Separator,
 ComponentType.Container,
];

const componentTypeOf = (value: unknown): number | null => {
 if (!value || typeof value !== 'object') return null;
 const { type } = value as { type?: unknown };
 return typeof type === 'number' ? type : null;
};

export const detectMessageJsonKind = (parsed: unknown): MessageJsonKind => {
 if (Array.isArray(parsed)) {
  if (!parsed.length) return MessageJsonKind.Unknown;
  return parsed.every((item) => componentTypeOf(item) !== null)
   ? MessageJsonKind.ComponentsV2
   : MessageJsonKind.Embeds;
 }
 if (!parsed || typeof parsed !== 'object') return MessageJsonKind.Unknown;

 const record = parsed as Record<string, unknown>;

 if (
  typeof record.flags === 'number' &&
  (record.flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2
 ) {
  return MessageJsonKind.ComponentsV2;
 }

 if (
  Array.isArray(record.components) &&
  record.components.some((item) => {
   const type = componentTypeOf(item);
   return type !== null && v2Types.includes(type);
  })
 ) {
  return MessageJsonKind.ComponentsV2;
 }

 if (Array.isArray(record.embeds) && record.embeds.length) return MessageJsonKind.Embeds;
 if (componentTypeOf(record) !== null) return MessageJsonKind.ComponentsV2;
 return MessageJsonKind.Embeds;
};
