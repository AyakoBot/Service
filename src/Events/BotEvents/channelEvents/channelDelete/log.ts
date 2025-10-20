import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (
 channel:
  | Discord.CategoryChannel
  | RChannel
  | RChannel
  | RChannel
  | RThread
  | Discord.PublicThreadChannel
  | Discord.VoiceChannel
  | Discord.ForumChannel
  | Discord.MediaChannel
  | Discord.AnyThreadChannel,
) => {
 if (!channel.guild.id) return;

 const channels = await channel.client.util.getLogChannels('channelevents', channel.guild);
 if (!channels) return;

 const language = await channel.client.util.getLanguage(channel.guild.id);
 const lan = language.events.logs.channel;
 const con = channel.client.util.constants.events.logs.channel;
 const audit = await channel.client.util.getAudit(
  channel.guild,
  [10, 11, 12].includes(channel.type) ? 112 : 12,
  channel.id,
 );
 const channelType = `${channel.client.util.getTrueChannelType(channel, channel.guild)}Delete`;
 const getChannelOwner = () => {
  if (audit?.executor) return audit.executor;
  if ('ownerId' in channel && channel.ownerId) {
   return channel.client.util.getUser(channel.ownerId).catch(() => undefined);
  }
  return undefined;
 };
 const auditUser = await getChannelOwner();

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: con[channelType as keyof typeof con],
   name: lan.nameDelete,
  },
  description: auditUser
   ? lan.descDeleteAudit(auditUser, channel, language.channelTypes[channel.type])
   : lan.descDelete(channel, language.channelTypes[channel.type]),
  fields: [],
  color: CT.Colors.Danger,
  timestamp: new Date().toISOString(),
 };

 const embeds = [embed];

 const flags = new Discord.ChannelFlagsBitField(channel.flags || 0).toArray();

 const flagsText = [
  ...flags.map((f) => language.events.logs.guild.systemChannelFlags[f]),
  'nsfw' in channel && channel.nsfw ? lan.nsfw : null,
  'archived' in channel && channel.archived ? lan.archived : null,
  'locked' in channel && channel.locked ? lan.locked : null,
  'invitable' in channel && channel.invitable ? lan.invitable : null,
 ]
  .filter((f): f is string => !!f)
  .map((f) => `\`${f}\``)
  .join(', ');

 if (flagsText?.length) {
  embed.fields?.push({
   name: language.t.Flags,
   value: flagsText,
   inline: true,
  });
 }

 if ('topic' in channel && channel.topic) {
  embed.fields?.push({ name: lan.topic, value: channel.topic, inline: true });
 }

 if ('bitrate' in channel && channel.bitrate) {
  embed.fields?.push({ name: lan.bitrate, value: `${channel.bitrate}kbps`, inline: true });
 }

 if ('userLimit' in channel && channel.userLimit) {
  embed.fields?.push({ name: lan.userLimit, value: String(channel.userLimit), inline: true });
 }

 if ('rateLimitPerUser' in channel && channel.rateLimitPerUser) {
  embed.fields?.push({
   name: lan.rateLimitPerUser,
   value: channel.client.util.moment(channel.rateLimitPerUser, language),
   inline: true,
  });
 }

 if ('rtcRegion' in channel && channel.rtcRegion) {
  embed.fields?.push({
   name: lan.rtcRegion,
   value: language.regions[channel.rtcRegion as keyof typeof language.regions],
   inline: true,
  });
 }

 if ('videoQualityMode' in channel && channel.videoQualityMode) {
  embed.fields?.push({
   name: lan.videoQualityModeName,
   value: lan.videoQualityMode[channel.videoQualityMode],
   inline: true,
  });
 }

 if ('nsfw' in channel && channel.parentId) {
  const parent = channel.parentId
   ? await channel.client.util.getChannel.parentChannel(channel.parentId)
   : undefined;

  if (parent) {
   embed.fields?.push({
    name: lan.parentChannel,
    value: language.languageFunction.getChannel(parent, language.channelTypes[4]),
    inline: true,
   });
  }
 }

 if ('autoArchiveDuration' in channel && channel.autoArchiveDuration) {
  embed.fields?.push({
   name: lan.autoArchiveDuration,
   value: channel.client.util.moment(channel.autoArchiveDuration * 60000, language),
   inline: true,
  });
 }

 if ('permissionOverwrites' in channel) {
  const permEmbed: Discord.APIEmbed = {
   color: CT.Colors.Ephemeral,
   description: channel.permissionOverwrites.cache
    .map(
     (perm) =>
      `${
       perm.type === Discord.OverwriteType.Member ? `<@${perm.id}>` : `<@&${perm.id}>`
      }\n${Object.entries(new Discord.PermissionsBitField(perm.allow.bitfield).serialize())
       .filter(([, a]) => !!a)
       .map(
        (permissionString) =>
         `${channel.client.util.constants.standard.getEmote(
          channel.client.util.emotes.enabled,
         )} \`${
          language.permissions.perms[permissionString[0] as keyof typeof language.permissions.perms]
         }\``,
       )
       .join('\n')}\n${Object.entries(
       new Discord.PermissionsBitField(perm.deny.bitfield).serialize(),
      )
       .filter(([, a]) => !!a)
       .map(
        (permissionString) =>
         `${channel.client.util.constants.standard.getEmote(
          channel.client.util.emotes.disabled,
         )} \`${
          language.permissions.perms[permissionString[0] as keyof typeof language.permissions.perms]
         }\``,
       )
       .join('\n')}`,
    )
    .join('\n\n'),
  };

  embeds.push(permEmbed);
 }

 channel.client.util.send({ id: channels, guildId: channel.guild.id }, { embeds }, 10000);
};
