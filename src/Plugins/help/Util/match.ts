import { compareTwoStrings } from 'string-similarity';

import type { HelpCommandView, HelpSurface } from '../Classes/HelpTypes.js';
import { HelpSource } from './normalize.js';
import { pathKey } from './path.js';

export enum MatchKind {
 Exact = 'exact',
 Name = 'name',
 Fuzzy = 'fuzzy',
 None = 'none',
}

export interface MatchResult {
 kind: MatchKind;
 target: HelpCommandView | null;
 closest: string | null;
}

const totalLeaves = (surface: HelpSurface): string[] => [
 ...surface.leaves,
 ...surface.contextMenus.map((entry) => entry.name),
];

const bestMatch = (candidates: string[], query: string): string | null => {
 if (!candidates.length) return null;

 let best = candidates[0]!;
 let score = -1;

 candidates.forEach((candidate) => {
  const current = compareTwoStrings(candidate.toLowerCase(), query.toLowerCase());
  if (current > score) {
   score = current;
   best = candidate;
  }
 });

 return best;
};

const exactPath = (surface: HelpSurface, query: string): HelpCommandView | null =>
 surface.byPath.get(pathKey(query.split(' '))) ?? null;

const bareName = (surface: HelpSurface, query: string): HelpCommandView | null => {
 if (query.includes(' ')) return null;

 const entries = surface.byName.get(query);
 if (!entries?.length) return null;

 return entries.find((entry) => entry.source === HelpSource.Slash) ?? entries[0]!;
};

export const resolveCommand = (surface: HelpSurface, raw: string): MatchResult => {
 const query = raw.trim();
 if (!query) return { kind: MatchKind.None, target: null, closest: null };

 const exact = exactPath(surface, query);
 if (exact) return { kind: MatchKind.Exact, target: exact, closest: null };

 const named = bareName(surface, query);
 if (named) return { kind: MatchKind.Name, target: named, closest: named.fullName };

 const closest = bestMatch(totalLeaves(surface), query);
 if (!closest) return { kind: MatchKind.None, target: null, closest: null };

 return {
  kind: MatchKind.Fuzzy,
  target: exactPath(surface, closest) ?? bareName(surface, closest),
  closest,
 };
};
