import { cache, user } from '../Client.js';
import { guild as getBotIdFromGuild } from './getBotIdFrom.js';

export default async (guildId: string) =>
 (await cache.members.get(guildId, await getBotIdFromGuild(guildId))) ??
 (await cache.members.get(guildId, user.id)!)!;
