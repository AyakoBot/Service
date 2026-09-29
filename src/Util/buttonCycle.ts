import {
 ButtonStyle,
 ComponentType,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

const cycle = [
 ButtonStyle.Primary,
 ButtonStyle.Success,
 ButtonStyle.Danger,
 ButtonStyle.Secondary,
] as const;

export const firstCycledStyle = cycle[0];

export const nextButtonStyle = (
 components: APIMessageTopLevelComponent[] | undefined,
 customId: string,
): ButtonStyle => {
 const current = (components ?? [])
  .flatMap((component) => (component.type === ComponentType.ActionRow ? component.components : []))
  .find(
   (child) =>
    child.type === ComponentType.Button && 'custom_id' in child && child.custom_id === customId,
  );
 const index = current?.type === ComponentType.Button ? cycle.indexOf(current.style) : -1;

 return cycle[(index + 1) % cycle.length] ?? ButtonStyle.Primary;
};
