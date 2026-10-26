import { randomInt } from 'node:crypto';

const draw = (pool: string[], count: number): string[] => {
 const source = [...new Set(pool)];
 const drawn: string[] = [];

 while (drawn.length < count && source.length) {
  drawn.push(...source.splice(randomInt(source.length), 1));
 }

 return drawn;
};

export default draw;

export const drawWeighted = (weights: Map<string, number>, count: number): string[] => {
 const pool = [...weights.entries()].filter(([, weight]) => weight > 0);
 const drawn: string[] = [];

 while (drawn.length < count && pool.length) {
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let ticket = randomInt(total);
  let index = 0;

  while (index < pool.length - 1 && ticket >= pool[index][1]) {
   ticket -= pool[index][1];
   index += 1;
  }

  drawn.push(pool.splice(index, 1)[0][0]);
 }

 return drawn;
};

export const excluding = (weights: Map<string, number>, ids: string[]) =>
 new Map([...weights].filter(([id]) => !ids.includes(id)));

export interface RerollPlan {
 kept: string[];
 keptUnclaimed: string[];
 freshCount: number;
}

const preferring = (first: string[], rest: string[], count: number) => [
 ...draw(first, count),
 ...draw(rest, count - Math.min(count, first.length)),
];

export const planReroll = (
 winners: string[],
 unclaimed: string[],
 target: number,
 count: number,
): RerollPlan => {
 const isUnclaimed = (id: string) => unclaimed.includes(id);
 const dropCount = Math.min(count, winners.length);
 const dropped = preferring(
  winners.filter(isUnclaimed),
  winners.filter((id) => !isUnclaimed(id)),
  dropCount,
 );

 const remaining = winners.filter((id) => !dropped.includes(id));
 const kept = preferring(
  remaining.filter((id) => !isUnclaimed(id)),
  remaining.filter(isUnclaimed),
  Math.min(remaining.length, Math.max(target - dropCount, 0)),
 );

 return {
  kept,
  keptUnclaimed: kept.filter(isUnclaimed),
  freshCount: Math.max(target - kept.length, 0),
 };
};
