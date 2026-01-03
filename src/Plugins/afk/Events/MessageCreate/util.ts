import type AFKPlugin from '../../Plugin.js';

export const deleteNick = async function (
 this: AFKPlugin,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
 guildId: string,
 memberId: string,
) {
 const member = await this.client.cache.members.get(guildId, memberId);
 if (!member?.nick || !member.nick.endsWith(' [AFK]')) return;

 this.client.api.guilds.editMember(
  member.guild_id,
  member.user_id,
  { nick: member.nick.slice(0, member.nick.length - 6) },
  { reason: t.t.removeReason() },
 );
};
