import { RequestHandlerError } from '@ayako/api';
import type { RInvite } from '@ayako/utility';

import type Client from '../Classes/Client.js';

export default async function (this: Client, guildId: string): Promise<RInvite | null> {
 const before = await this.cache.invites.getAll(guildId);
 const api = await this.getAPI(guildId);
 const after = await api.guilds.getInvites(guildId, {
  origin: 'Logging invite attribution',
  reason: 'Resolving the invite used by a joining member',
 });

 if (after instanceof RequestHandlerError) return null;

 const previous = new Map(before.map((invite) => [invite.code, invite.uses]));

 return (
  after
   .filter((invite): invite is RInvite => !!invite)
   .find((invite) => invite.uses > (previous.get(invite.code) ?? invite.uses)) ?? null
 );
}
