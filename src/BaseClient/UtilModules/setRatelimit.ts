import { scheduleDB } from '../Redis.js';

export const prefix = 'ratelimit';

export default (key: string, expire: number) =>
 scheduleDB.setex(`${prefix}:${key}`, expire, 'true');
