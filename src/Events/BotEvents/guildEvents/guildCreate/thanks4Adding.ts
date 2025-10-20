import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

const threadPerms = new Discord.PermissionsBitField([
 PermissionFlagsBits.CreatePrivateThreads,
 PermissionFlagsBits.SendMessagesInThreads,
]);

export default async (guild: Discord.Guild) => {
 const rawChannel = getChannel(guild);
 if (!rawChannel.channel) return;

 let channel:
  | RChannel
  | RThread
  | Error
  | Discord.DiscordAPIError
  | undefined = rawChannel.thread
  ? await guild.client.util.request.channels.createThread(rawChannel.channel, {
     name: '💝',
     type: ChannelType.PrivateThread,
    })
  : rawChannel.channel;

 if (!channel || 'message' in channel) channel = getChannel(guild, true).channel;
 if (!channel) return;

 const adder = await getAdder(guild);
 if (channel.type === ChannelType.PrivateThread && !adder) return;

 guild.client.util.send(
  channel,
  getPayload(guild, adder ?? undefined, await guild.client.util.getLanguage(guild.id)),
 );
};

export const getPayload = (
 guild: Discord.Guild,
 adder: string | undefined,
 language: CT.Language,
): CT.UsualMessagePayload => ({
 content: adder
  ? language.events.guildMemberAdd.thanks4Adding.thanksUser(adder)
  : language.events.guildMemberAdd.thanks4Adding.thanks,
 embeds: [
  {
   color: CT.Colors.Base,
   description: language.events.guildMemberAdd.thanks4Adding.desc,
   fields: language.events.guildMemberAdd.thanks4Adding
    .fields(guild)
    .map((f) => ({ ...f, inline: false })),
  },
 ],
 components: [
  {
   type: Discord.ComponentType.ActionRow,
   components: [
    {
     type: Discord.ComponentType.Button,
     label: language.events.guildMemberAdd.thanks4Adding.buttons.mod,
     style: Discord.ButtonStyle.Primary,
     custom_id: 'thanks4Adding/mod',
     emoji: guild.client.util.emotes.ban,
    },
    {
     type: Discord.ComponentType.Button,
     label: language.events.guildMemberAdd.thanks4Adding.buttons.rp,
     style: Discord.ButtonStyle.Primary,
     custom_id: 'thanks4Adding/rp',
     emoji: guild.client.util.emotes.rp,
    },
    {
     type: Discord.ComponentType.Button,
     label: language.events.guildMemberAdd.thanks4Adding.buttons.settings,
     style: Discord.ButtonStyle.Primary,
     custom_id: 'thanks4Adding/settings',
     emoji: guild.client.util.emotes.settings,
    },
   ],
  },
  {
   type: Discord.ComponentType.ActionRow,
   components: [
    {
     type: Discord.ComponentType.Button,
     label: 'YouTube',
     url: 'https://youtube.com/@AyakoBot',
     style: Discord.ButtonStyle.Link,
     emoji: guild.client.util.emotes.youtube,
    },
    {
     type: Discord.ComponentType.Button,
     label: language.events.guildMemberAdd.thanks4Adding.buttons.support,
     style: Discord.ButtonStyle.Link,
     url: guild.client.util.constants.standard.support,
     emoji: guild.client.util.emotes.userFlags.DiscordEmployee,
    },
   ],
  },
 ],
});

const getAdder = async (guild: Discord.Guild) => {
 const logs = await guild.client.util.request.guilds.getAuditLogs(guild, {
  action_type: Discord.AuditLogEvent.BotAdd,
  limit: 50,
 });
 if ('message' in logs) return undefined;

 return logs.entries.find((e) => e.targetId === guild.client.user?.id)?.executorId;
};

const getChannel = (guild: Discord.Guild, sendable?: true) => {
 const getAnyThreadableChannel = () =>
  guild.channels.cache.find(
   (c) =>
    guild.members.me?.permissionsIn(c).has(threadPerms) &&
    [
     ChannelType.PublicThread,
     ChannelType.AnnouncementThread,
     ChannelType.PrivateThread,
    ].includes(c.type),
  ) as RChannel | RChannel | undefined;

 const getAnySendableChannel = () =>
  guild.channels.cache.find(
   (c) =>
    guild.members.me?.permissionsIn(c).has(PermissionFlagsBits.SendMessages) &&
    [ChannelType.GuildText, ChannelType.GuildVoice].includes(c.type) &&
    ![
     ChannelType.GuildNewsThread,
     ChannelType.GuildPublicThread,
     ChannelType.GuildPrivateThread,
    ].includes(c.type),
  ) as RChannel | undefined;

 if (sendable) return { thread: false, channel: getAnySendableChannel() };

 const threadableChannel = { thread: true, channel: getAnyThreadableChannel() };
 const sendableChannel = { thread: false, channel: getAnySendableChannel() };

 if (!guild.members.me) {
  return threadableChannel.channel ? threadableChannel : sendableChannel;
 }

 if (!guild.rulesChannel || !guild.rulesChannel.permissionsFor(guild.members.me).has(threadPerms)) {
  return threadableChannel.channel ? threadableChannel : sendableChannel;
 }

 return { thread: true, channel: guild.rulesChannel };
};
