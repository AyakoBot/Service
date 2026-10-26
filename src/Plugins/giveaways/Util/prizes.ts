export interface PrizeSlot {
 position: number;
 winner: string | null;
 claimed: boolean;
}

export interface PrizeAssignment {
 position: number;
 winner: string;
}

export interface PrizePlan {
 release: number[];
 assign: PrizeAssignment[];
}

export const planPrizes = (slots: PrizeSlot[], winners: string[]): PrizePlan => {
 const ordered = [...slots].sort((a, b) => a.position - b.position);
 const current = new Set(winners);

 const release = ordered
  .filter((slot) => slot.winner && !slot.claimed && !current.has(slot.winner))
  .map((slot) => slot.position);

 const held = new Set(
  ordered
   .filter((slot) => slot.winner && !release.includes(slot.position))
   .map((slot) => slot.winner),
 );
 const free = ordered
  .filter((slot) => !slot.winner || release.includes(slot.position))
  .map((slot) => slot.position);

 return {
  release,
  assign: winners
   .filter((id) => !held.has(id))
   .slice(0, free.length)
   .map((winner, index) => ({ position: free[index], winner })),
 };
};
