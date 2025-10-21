import type * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (audit: RAuditLog, guild: RGuild) => {
 const channels = await guild.client.util.getLogChannels('guildevents', guild);
 if (!channels) return;

 const language = await guild.client.util.getLanguage(guild.id);
 const lan = language.events.logs.guild;
 const con = guild.client.util.constants.events.logs.guild;
 const extra = audit.extra as { removed: number; days: number };

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: con.Prune,
   name: lan.memberPrune,
  },
  description: lan.descMemberPrune(audit.executor as RUser, extra.removed, extra.days),
  color: CT.Colors.Danger,
  timestamp: new Date().toISOString(),
 };

 guild.client.util.send({ id: channels, guildId: guild.id }, { embeds: [embed] }, 10000);
};
