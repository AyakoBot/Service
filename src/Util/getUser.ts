import type Client from '../Classes/Client.js';

export default async function (this: Client, userId: string) {
 const cached = await this.cache.users.get(userId);
 if (cached) return cached;

 const fetched = await (await this.getAPI()).users
  .get(userId, { origin: 'User Fetch', reason: 'Fetching user data' })
  .catch(() => null);
 return fetched;
}
