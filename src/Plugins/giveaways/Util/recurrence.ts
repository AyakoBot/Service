export const nextRunAfter = (booked: number, intervalMs: number, now: number) => {
 const steps = Math.max(1, Math.floor((now - booked) / intervalMs) + 1);
 return booked + steps * intervalMs;
};
