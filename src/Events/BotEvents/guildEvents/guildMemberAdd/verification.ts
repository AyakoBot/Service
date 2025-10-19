import Prisma from '@prisma/client';
import type * as Discord from 'discord.js';
import { scheduleJob } from 'node-schedule';
import * as CT from '../../../../Typings/Typings.js';
import { canRemoveMember } from '../../../../BaseClient/UtilModules/requestHandler/guilds/removeMember.js';
import { canAddRoleToMember } from '../../../../BaseClient/UtilModules/requestHandler/guilds/addRoleToMember.js';
import getPathFromError from '../../../../BaseClient/UtilModules/getPathFromError.js';

export default async (member: RMember) => {
 const verification = await member.client.util.DataBase.verification.findUnique({
  where: {
   guildid: member.guild.id,
   active: true,
   pendingrole: { not: null },
  },
 });
 if (!verification) return;

 const language = await member.client.util.getLanguage(member.guild.id);

 preverified(member, verification, language);
 prepKick(member, verification, language);
};

const preverified = async (
 member: RMember,
 verification: Prisma.verification,
 language: CT.Language,
) => {
 if (!verification.pendingrole) return;
 member.client.util.roleManager.add(
  member,
  [verification.pendingrole],
  language.verification.log.started,
  1,
 );
};

const prepKick = async (
 member: RMember,
 verification: Prisma.verification,
 language: CT.Language,
) => {
 if (!verification.kicktof) return;
 if (!verification.kickafter) return;
 if (member.user.bot) return;

 scheduleJob(
  getPathFromError(new Error(verification.guildid)),
  new Date(Date.now() + Number(verification.kickafter) * 1000),
  async () => {
   kick(member, verification, language);
  },
 );
};

export const kick = async (
 member: RMember,
 verification: Prisma.verification,
 language: CT.Language,
) => {
 const verifyRole = verification.finishedrole
  ? member.guild.roles.cache.get(verification.finishedrole)
  : false;

 if (!verifyRole) return;
 if (member.roles.cache.has(verifyRole.id)) return;
 if (!verification.kicktof) return;
 if (!verification.kickafter) return;
 if (member.user.bot) return;

 const me = await member.client.util.getBotMemberFromGuild(member.guild);
 if (!canRemoveMember(me, member)) return;
 if (!canAddRoleToMember(verifyRole.id, me)) return;

 const dm = async () => {
  member.client.util.send(member.user, {
   content: language.verification.kickMsg(member.guild),
  });
 };

 await dm();
 member.client.util.request.guilds.removeMember(member, language.verification.kickReason);
};
