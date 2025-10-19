import Prisma from '@prisma/client';
import * as Discord from 'discord.js';
import client from '../../../BaseClient/Client.js';
import * as CT from '../../../Typings/Typings.js';

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) {
  client.util.guildOnly(cmd);
  return;
 }
 await cmd.deferReply({ ephemeral: true });

 const language = await client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.leaderboard;
 const user = cmd.options.getUser('user', false) ?? cmd.user;

 const nitroUsers = await client.util.DataBase.nitrousers.findMany({
  where: { guildid: cmd.guildId },
 });

 const daysPerUser = getDaysPerUsers(nitroUsers)
  .sort((a, b) => b.days - a.days)
  .splice(0, 29);

 const self = await client.util.DataBase.nitrousers.findMany({
  where: { userid: user.id, guildid: cmd.guildId },
 });

 const position = self ? daysPerUser.findIndex((s) => s.userId === user.id) + 1 : '-';
 const users = await Promise.all(daysPerUser.map((d) => client.util.getUser(d.userId)));

 const { longestDays, longestUsername } = getLongest({ lan, language }, daysPerUser, users);

 const embed = await getEmbed(
  { lan, language },
  position,
  { days: Number(getDaysPerUsers(self)[0]?.days), longestDays, daysPerUser },
  { displayNames: users.map((u) => u?.displayName ?? '-'), longestUsername },
  user,
  cmd.guild,
 );

 cmd.editReply({
  embeds: [embed],
  // components: [
  //  {
  //   type: Discord.ComponentType.ActionRow,
  //   components: [
  //    {
  //     type: Discord.ComponentType.Button,
  //     url: `https://ayakobot.com/guilds/${cmd.guildId}/leaderboard#nitro`,
  //     label: lan.fullLeaderboard,
  //     style: Discord.ButtonStyle.Link,
  //    },
  //   ],
  //  },
  // ],
 });
};

const getDaysPerUsers = (nitroUsers: Prisma.nitrousers[]) => {
 const daysPerUser: { userId: string; days: number }[] = [];
 nitroUsers.forEach((u) => {
  const days = getDaysBetween2Days(Number(u.booststart), Number(u.boostend) || Date.now());
  const user = daysPerUser.find((d) => d.userId === u.userid);

  if (user) user.days += days;
  else daysPerUser.push({ days, userId: u.userid });
 });
 return daysPerUser;
};

const getDaysBetween2Days = (date1: number, date2: number) => {
 const diffTime = Math.abs(date2 - date1);
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return diffDays;
};

const getLongest = (
 { lan, language }: { lan: CT.Language['slashCommands']['leaderboard']; language: CT.Language },
 daysPerUser: { days: number; userId: string }[],
 users: (RUser | undefined)[],
) => {
 let longestDays = Math.max(...daysPerUser.map((l) => String(l.days).length));
 let longestUsername = Math.max(
  ...users
   .map((u) =>
    u
     ? String(u?.displayName)
        .replace(/[^\w\s'|\-!"§$%&/()=?`´{[\]}^°<>,;.:-_#+*~]/g, '')
        .replace(/\s+/g, ' ')
     : '-',
   )
   .map((u) => u.length + 1),
 );

 if (longestDays < lan.days.length) longestDays = lan.level.length;
 if (longestUsername < language.t.User.length) longestUsername = language.t.User.length;

 return { longestUsername, longestDays };
};

export const makeLine = (
 pos: number | string,
 { days, longestDays }: { days: number; longestDays: number },
 { displayName, longestUsername }: { displayName: string; longestUsername: number },
) => {
 const name = displayName
  .replace(/[^\w\s'|\-!"§$%&/()=?`´{[\]}^°<>,;.:-_#+*~]/g, '')
  .replace(/\s+/g, ' ');

 return `${client.util.spaces(
  `${typeof pos === 'number' ? client.util.splitByThousand(pos + 1) : pos}.`,
  7,
 )} | ${client.util.spaces(String(days), longestDays)} | ${client.util.spaces(
  name.length > 3 ? name : '-',
  longestUsername,
 )}`;
};

const getEmbed = async (
 { lan, language }: { lan: CT.Language['slashCommands']['leaderboard']; language: CT.Language },
 position: number | string,
 {
  days,
  longestDays,
  daysPerUser,
 }: { days: number; longestDays: number; daysPerUser: { days: number; userId: string }[] },
 { displayNames, longestUsername }: { displayNames: string[]; longestUsername: number },
 user: RUser,
 guild: Discord.Guild,
): Promise<Discord.APIEmbed> => ({
 author: {
  name: lan.nleaderboard,
 },
 fields: [
  {
   name: lan.yourPos,
   value: position
    ? `${client.util.util.makeInlineCode(
       makeLine(
        typeof position === 'number' ? position - 1 : position,
        { days, longestDays },
        { displayName: user.displayName, longestUsername },
       ),
      )}`
    : lan.notRanked,
  },
 ],
 color: client.util.getColor(await client.util.getBotMemberFromGuild(guild)),
 description: `${client.util.util.makeInlineCode(
  `${client.util.spaces(lan.rank, 7)} | ${client.util.spaces(
   lan.days,
   longestDays,
  )} |  ${client.util.spaces(language.t.User, longestUsername)}\n${daysPerUser
   .map((l, i) =>
    makeLine(
     i,
     { days: l.days, longestDays },
     { displayName: displayNames[i] || '-', longestUsername },
    ),
   )
   .join('\n')}`,
 )}`,
});
