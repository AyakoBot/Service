import * as Discord from 'discord.js';
import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.events.vote,
 bot: (user: RUser, bot: RUser, link: string) =>
  t.stp(t.JSON.events.vote.bot, {
   user: user.displayName,
   bot: bot.username,
   link,
  }),
 guild: (user: RUser, guild: Discord.Guild, link: string) =>
  t.stp(t.JSON.events.vote.guild, {
   user: user.displayName,
   guild: guild.name,
   link,
  }),
 tempReward: (reward: string) =>
  t.stp(t.JSON.events.vote.tempReward, {
   reward,
  }),
 botReason: (bot: RUser) =>
  t.stp(t.JSON.events.vote.botReason, {
   bot: bot.username,
  }),
 guildReason: (guild: Discord.Guild) =>
  t.stp(t.JSON.events.vote.guildReason, {
   guild: guild.name,
  }),
 reminder: {
  ...t.JSON.events.vote.reminder,
  descBot: (bot: RUser) =>
   t.stp(t.JSON.events.vote.reminder.descBot, {
    bot: t.util.constants.standard.user(bot),
   }),
  descGuild: (guild: Discord.Guild) =>
   t.stp(t.JSON.events.vote.reminder.descGuild, {
    guild: guild.name,
   }),
  voteBotButton: (bot: RUser) =>
   t.stp(t.JSON.events.vote.reminder.voteBotButton, {
    bot: bot.username,
   }),
  voteGuildButton: (guild: Discord.Guild) =>
   t.stp(t.JSON.events.vote.reminder.voteGuildButton, {
    guild: guild.name,
   }),
 },
});
