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
       ChannelType.AnnouncementThread,
       ChannelType.GuildAnnouncement,
       ChannelType.GuildDirectory,
       ChannelType.GuildForum,
       ChannelType.GuildStageVoice,
       ChannelType.GuildText,
       ChannelType.GuildVoice,
       ChannelType.PrivateThread,
       ChannelType.PublicThread,
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
