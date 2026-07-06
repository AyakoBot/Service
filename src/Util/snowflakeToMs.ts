const discordEpoch = 1420070400000n;

export const snowflakeToMs = (snowflake: string): number | null => {
 if (!/^\d+$/.test(snowflake)) return null;

 const ms = Number((BigInt(snowflake) >> 22n) + discordEpoch);
 return Number.isFinite(ms) ? ms : null;
};
