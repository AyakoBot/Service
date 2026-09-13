export const redisOk = 'OK';

export interface CooldownStore {
 set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
 del(...keys: string[]): Promise<number>;
}

export const claimCooldown = async (
 db: CooldownStore,
 key: string,
 seconds: number,
): Promise<boolean> => (await db.set(key, '1', 'NX', 'EX', seconds)) === redisOk;

export const releaseCooldown = (db: CooldownStore, key: string): Promise<number> => db.del(key);

export const dayEpoch = (now: number = Date.now()): number => Math.floor(now / 86_400_000);
