import { RequestHandlerError } from '@ayako/api';

import getUser from '../../../Util/getUser.js';
import type AFKPlugin from '../Plugin.js';

const afkNickSuffix = ' [AFK]';

export const setNick = async function (this: AFKPlugin, userId: string, guildId: string) {
 const member = await this.client.cache.members.get(guildId, userId);
 if (!member) return undefined;

 const user = member.nick
  ? { username: '', global_name: '' }
  : await getUser.call(this.client, userId);
 if (user instanceof RequestHandlerError || !user) return undefined;

 const res = await (await this.getAPI(guildId)).guilds.editMember(
  guildId,
  userId,
  {
   nick: member.nick
    ? `${member.nick}${afkNickSuffix}`
    : `${user.global_name || user.username}${afkNickSuffix}`,
  },
  { origin: this.name, reason: 'Reflect AFK status in nickname' },
 );

 if (res instanceof RequestHandlerError) this.nonFatalError(res, setNick.name);
};

export const deleteNick = async function (
 this: AFKPlugin,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
 guildId: string,
 memberId: string,
) {
 const member = await this.client.cache.members.get(guildId, memberId);
 if (!member?.nick || !member.nick.endsWith(afkNickSuffix)) return;

 const res = await (await this.getAPI(guildId)).guilds.editMember(
  member.guild_id,
  member.user_id,
  { nick: member.nick.slice(0, -afkNickSuffix.length) },
  { reason: t.t.removeReason(), origin: this.name },
 );

 if (res instanceof RequestHandlerError) this.nonFatalError(res, deleteNick.name);
};
