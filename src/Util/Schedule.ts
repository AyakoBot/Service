import type Client from '../Classes/Client.js';

const markerKey = (key: string) => `scheduled:${key}`;
const dataKey = (key: string) => `scheduled-data:${key}`;

export const arm = async (client: Client, key: string, value: string, seconds: number) => {
 const db = client.cache.scheduleDb;
 if (!db) return;
 if (seconds <= 0) return;

 await db.set(markerKey(key), 'true', 'EX', Math.max(1, Math.round(seconds)));
 await db.set(dataKey(key), value);
};

export const disarm = async (client: Client, key: string) => {
 const db = client.cache.scheduleDb;
 if (!db) return;

 await db.del(markerKey(key), dataKey(key));
};

export const isArmed = async (client: Client, key: string) => {
 const db = client.cache.scheduleDb;
 if (!db) return false;

 return (await db.expiretime(markerKey(key))) > 0;
};

export const readData = async (client: Client, key: string) => {
 const db = client.cache.scheduleDb;
 if (!db) return null;

 return db.get(dataKey(key));
};

export const scanDataKeys = async (client: Client, match: string): Promise<string[]> => {
 const db = client.cache.scheduleDb;
 if (!db) return [];

 const keys: string[] = [];
 let cursor = '0';

 do {
  const res = (await db.call('SCAN', cursor, 'MATCH', match, 'COUNT', 200)) as [string, string[]];
  const [next, batch] = res;
  cursor = next;
  keys.push(...batch);
 } while (cursor !== '0');

 return [...new Set(keys)];
};

export const stripMarkerPrefix = (rawKey: string) => rawKey.replace(/^scheduled:/, '');
export const stripDataPrefix = (rawKey: string) => rawKey.replace(/^scheduled-data:/, '');
