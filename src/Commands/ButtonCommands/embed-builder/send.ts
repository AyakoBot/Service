import * as Discord from 'discord.js';

export default async (cmd: Discord.ButtonInteraction) => {
 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.embedbuilder.send;

 cmd.update({
  components: [
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.ChannelSelect,
      customId: 'embed-builder/send',
      minValues: 1,
      maxValues: 25,
      placeholder: lan.placeholder,
      channelTypes: [
       Discord.ChannelType.AnnouncementThread,
       Discord.ChannelType.GuildAnnouncement,
       Discord.ChannelType.GuildDirectory,
       Discord.ChannelType.GuildForum,
       Discord.ChannelType.GuildStageVoice,
       Discord.ChannelType.GuildText,
       Discord.ChannelType.GuildVoice,
       Discord.ChannelType.PrivateThread,
       Discord.ChannelType.PublicThread,
      ],
     },
    ],
   },
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.Button,
      style: Discord.ButtonStyle.Primary,
      customId: `embed-builder/back`,
      emoji: cmd.client.util.emotes.back,
     },
    ],
   },
  ],
 });
};
