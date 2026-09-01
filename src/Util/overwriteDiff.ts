import type { APIOverwrite } from 'discord-api-types/v10';

export interface OverwriteChange {
 overwrite: APIOverwrite;
 previous: APIOverwrite;
}

export interface OverwriteDiff {
 added: APIOverwrite[];
 changed: OverwriteChange[];
 removed: APIOverwrite[];
}

export const canonicalOverwrites = (overwrites?: APIOverwrite[] | null): string =>
 (overwrites ?? [])
  .map((o) => `${o.id}:${o.type}:${String(o.allow)}:${String(o.deny)}`)
  .sort()
  .join(',');

const bitsDiffer = (previous: APIOverwrite, overwrite: APIOverwrite): boolean =>
 BigInt(previous.allow) !== BigInt(overwrite.allow) ||
 BigInt(previous.deny) !== BigInt(overwrite.deny);

export const diffOverwrites = (
 previous?: APIOverwrite[] | null,
 current?: APIOverwrite[] | null,
): OverwriteDiff => {
 const before = new Map((previous ?? []).map((o) => [o.id, o]));
 const after = new Map((current ?? []).map((o) => [o.id, o]));

 return {
  added: (current ?? []).filter((o) => !before.has(o.id)),
  changed: (current ?? [])
   .map((overwrite) => ({ overwrite, previous: before.get(overwrite.id) }))
   .filter(
    (entry): entry is OverwriteChange =>
     !!entry.previous && bitsDiffer(entry.previous, entry.overwrite),
   ),
  removed: (previous ?? []).filter((o) => !after.has(o.id)),
 };
};
