import { StoredPunishmentTypes } from '@prisma/client';
import * as Discord from 'discord.js';

export default async (member: RMember) => {
 if (!member.communicationDisabledUntil) mute(member);
 else unmute(member);
};

const mute = async (member: RMember) => {
 const allMutes = await member.client.util.DataBase.punishments.findMany({
  where: { guildid: member.guild.id, userid: member.id, type: StoredPunishmentTypes.tempmute },
 });

 const activeMute = allMutes.find(
  (m) => Number(m.uniquetimestamp) + Number(m.duration) * 1000 > Date.now(),
 );
 if (!activeMute) return;

 member.client.util.request.guilds.editMember(
  member,
  {
   communication_disabled_until: new Date(
    Number(activeMute.uniquetimestamp) + Number(activeMute.duration) * 1000,
   ).toISOString(),
  },
  activeMute?.reason ?? undefined,
 );
};

const unmute = async (member: RMember) => {
 const allMutes = await member.client.util.DataBase.punishments.findMany({
  where: { guildid: member.guild.id, userid: member.id, type: StoredPunishmentTypes.tempmute },
 });

 const activeMute = allMutes.find(
  (m) => Number(m.uniquetimestamp) + Number(m.duration) * 1000 > Date.now(),
 );
 if (activeMute) return;

 member.client.util.request.guilds.editMember(member, { communication_disabled_until: null });
};
