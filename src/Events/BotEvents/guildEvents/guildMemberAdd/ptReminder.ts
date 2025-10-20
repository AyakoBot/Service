import * as Discord from 'discord.js';
import { API } from '../../../../BaseClient/Client.js';
import * as CT from '../../../../Typings/Typings.js';
import { canCreateThread } from '../../../../BaseClient/UtilModules/requestHandler/channels/createThread.js';

export default async (member: RMember) => {
 if (member.client.user.id !== process.env.mainId) return;
 if (!member.guild.rulesChannelId) return;
 if (!member.guild.members.me) return;

 if (
  member.guild.rulesChannel &&
  !(await canCreateThread(
   member.guild.rulesChannel,
   { type: ChannelType.PrivateThread, name: '' },
   member.guild.members.me,
  ))
 ) {
  return;
 }

 const guildsettings = await member.client.util.DataBase.guildsettings.findUnique({
  where: { guildid: member.guild.id },
 });
 if (!guildsettings?.ptreminderenabled) return;

 const user = await member.client.util.DataBase.users.findUnique({
  where: { userid: member.id },
 });
 if (user?.ptremindersent) return;

 const message = await member.client.util.notificationThread(member, {
  embeds: [
   {
    author: {
     name: "Hi! I don't think we've met before",
     url: member.client.util.constants.standard.invite,
    },
    title: "Here's a quick Guide to my Terms of Service and Privacy Policy",
    description:
     `At least one of the Servers you have joined uses Ayako (and possibly the Ayako Development Version) for some Features and/or Services.\n\n` +
     `**Terms of Service** https://ayakobot.com/terms\nViolation of any of these Terms can lead to your Access to Ayako being revoked.\n\n` +
     `**Privacy Policy** https://ayakobot.com/privacy\nAyako will never share or store sensitive Data or Information about you outside of Discord and outside the Discord Server you sent them in.`,
    fields: [
     {
      name: 'Support',
      value:
       'If you have Questions or would like your Stored Data to be deleted, join the Discord Server linked to this Message and use this Channel: <#996850314357522452>',
      inline: false,
     },
     {
      name: 'Opt-out',
      value: "You can opt-out of Ayako's Features by leaving every mutual Server with Ayako",
      inline: false,
     },
     {
      name: 'Disabling this Reminder',
      value:
       'Server Managers can disable this Reminder with the Command </settings basic:1072246330329669726>. However we ask you to link both, the /terms and the /privacy, URLs in one of your Info Channels if you do that.',
      inline: false,
     },
    ],
    color: CT.Colors.Base,
   },
  ],
  components: [
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.Button,
      label: 'Join Support Server',
      emoji: member.client.util.emotes.ayakoLove,
      style: Discord.ButtonStyle.Link,
      url: 'https://discord.gg/euTdctganf',
     },
     {
      type: Discord.ComponentType.Button,
      label: 'Invite Ayako',
      emoji: member.client.util.emotes.plusBG,
      style: Discord.ButtonStyle.Link,
      url: member.client.util.constants.standard.invite,
     },
     {
      type: Discord.ComponentType.Button,
      label: 'Vote for Ayako',
      emoji: member.client.util.emotes.ayakoLove2,
      style: Discord.ButtonStyle.Link,
      url: `https://top.gg/bot/${member.client.user.id}/vote`,
     },
    ],
   },
  ],
  content: 'Ayako Terms and Privacy Notice',
 });

 if (!message) return;

 API.channels.editMessage(message.channelId, message.id, {
  content: 'This Reminder will only be sent to you __once__ [⠀]( https://discord.gg/euTdctganf )',
 });

 member.client.util.DataBase.users
  .upsert({
   where: { userid: member.id },
   update: {
    ptremindersent: true,
    lastfetch: Date.now(),
    avatar: member.user.displayAvatarURL(),
    username: member.user.username,
    displayName: member.user.displayName,
   },
   create: {
    userid: member.id,
    ptremindersent: true,
    lastfetch: Date.now(),
    avatar: member.user.displayAvatarURL(),
    username: member.user.username,
    displayName: member.user.displayName,
   },
  })
  .then();
};
