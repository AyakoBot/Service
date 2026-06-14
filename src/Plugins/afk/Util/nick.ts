import { RequestHandlerError } from '@ayako/api';

import getUser from '../../../Util/getUser.js';
import type AFKPlugin from '../Plugin.js';

const nickLengthLimit = 32;
const afkNickSuffixFull = ' [AFK]';
const afkNickSuffixShort = ' AFK';

const afkNickSuffixFor = (baseLength: number) => {
 if (baseLength + afkNickSuffixFull.length <= nickLengthLimit) return afkNickSuffixFull;
 if (baseLength + afkNickSuffixShort.length <= nickLengthLimit) return afkNickSuffixShort;
 return undefined;
};

export const setNick = async function (this: AFKPlugin, userId: string, guildId: string) {
 const member = await this.client.cache.members.get(guildId, userId);
 if (!member) return undefined;

 const user = member.nick
  ? { username: '', global_name: '' }
  : await getUser.call(this.client, userId);
 if (user instanceof RequestHandlerError || !user) return undefined;

 const base = member.nick || user.global_name || user.username;
 const suffix = afkNickSuffixFor(base.length);
 if (!suffix) return undefined;

 const res = await (await this.getAPI(guildId)).guilds.editMember(
  guildId,
  userId,
  { nick: `${base}${suffix}` },
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
 if (!member?.nick) return;

 const { nick } = member;
 const suffix = [afkNickSuffixFull, afkNickSuffixShort].find(
  (s) => nick.endsWith(s) && afkNickSuffixFor(nick.length - s.length) === s,
 );
 if (!suffix) return;

 const res = await (await this.getAPI(guildId)).guilds.editMember(
  member.guild_id,
  member.user_id,
  { nick: nick.slice(0, -suffix.length) },
  { reason: t.t.removeReason(), origin: this.name },
 );

 if (res instanceof RequestHandlerError) this.nonFatalError(res, deleteNick.name);
};
