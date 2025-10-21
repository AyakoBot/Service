import type * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (invite: RInvite, guild: RGuild) => {
 const channels = await invite.client.util.getLogChannels('inviteevents', guild);
 if (!channels) return;

 const language = await invite.client.util.getLanguage(guild.id);
 const lan = language.events.logs.invite;
 const con = invite.client.util.constants.events.logs.invite;
 const audit = await invite.client.util.getAudit(guild, 40, invite.code);
 const auditUser = audit?.executor ?? undefined;

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: con.delete,
   name: lan.nameDelete,
  },
  description: auditUser ? lan.descDeleteAudit(auditUser, invite) : lan.descDelete(invite),
  fields: [],
  color: CT.Colors.Danger,
  timestamp: new Date().toISOString(),
 };

 const flagsText = [invite.temporary ? lan.temporary : null]
  .filter((f): f is string => !!f)
  .map((f) => `\`${f}\``)
  .join(', ');

 if (flagsText) {
  embed.fields?.push({
   name: lan.flagsName,
   value: flagsText,
   inline: true,
  });
 }

 if (invite.inviter) {
  embed.fields?.push({
   name: lan.inviter,
   value: language.languageFunction.getUser(invite.inviter),
   inline: false,
  });
 }

 if (invite.targetUser) {
  embed.fields?.push({
   name: lan.targetUser,
   value: language.languageFunction.getUser(invite.targetUser),
   inline: false,
  });
 }

 if (invite.channelId) {
  const channel = guild.channels.cache.get(invite.channelId);

  if (channel) {
   embed.fields?.push({
    name: language.t.Channel,
    value: language.languageFunction.getChannel(channel, language.channelTypes[channel.type]),
    inline: false,
   });
  }
 }

 if (invite.targetType) {
  embed.fields?.push({
   name: lan.targetTypeName,
   value: lan.targetType[invite.targetType],
  });
 }

 if (invite.createdAt) {
  embed.fields?.push({
   name: language.t.createdAt,
   value: invite.client.util.constants.standard.getTime(invite.createdAt.getTime()),
  });
 }

 if (invite.maxAge) {
  embed.fields?.push({
   name: lan.maxAge,
   value: invite.client.util.moment(invite.maxAge, language),
  });
 }

 embed.fields?.push({
  name: lan.maxUses,
  value: String(invite.maxUses || '∞'),
 });

 invite.client.util.send({ id: channels, guildId: guild.id }, { embeds: [embed] }, 10000);
};
