import {
 ComponentType,
 type APIComponentInContainer,
 type APIComponentInMessageActionRow,
 type APIMessageTopLevelComponent,
 type APIThumbnailComponent,
} from 'discord-api-types/v10';

export type CountableComponent =
 | APIMessageTopLevelComponent
 | APIComponentInContainer
 | APIComponentInMessageActionRow
 | APIThumbnailComponent;

export type WipTree = APIMessageTopLevelComponent[];
export type WipNode = CountableComponent;

export const accessorySegment = 'a';

export const childrenOf = (node: CountableComponent): CountableComponent[] | null => {
 switch (node.type) {
  case ComponentType.ActionRow:
  case ComponentType.Container:
  case ComponentType.Section:
   return node.components;
  default:
   return null;
 }
};

export const flattenTree = (
 components: CountableComponent[],
): { path: string; node: CountableComponent; depth: number }[] => {
 const out: { path: string; node: CountableComponent; depth: number }[] = [];

 const walk = (node: CountableComponent, path: string, depth: number) => {
  if (!node || typeof node !== 'object') return;
  out.push({ path, node, depth });
  childrenOf(node)?.forEach((child, index) => walk(child, `${path}.${index}`, depth + 1));
  if (node.type === ComponentType.Section && node.accessory) {
   walk(node.accessory, `${path}.${accessorySegment}`, depth + 1);
  }
 };

 components.forEach((node, index) => walk(node, String(index), 0));
 return out;
};

export const countComponents = (components: CountableComponent[]): number =>
 flattenTree(components).length;

export const countText = (components: CountableComponent[]): number =>
 flattenTree(components).reduce(
  (total, entry) =>
   total +
   (entry.node.type === ComponentType.TextDisplay && typeof entry.node.content === 'string'
    ? entry.node.content.length
    : 0),
  0,
 );
