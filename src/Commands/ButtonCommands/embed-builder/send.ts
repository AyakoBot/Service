import * as Discord from 'discord.js';

export default async (cmd: Discord.ButtonInteraction) => {
 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.embedbuilder.send;

 cmd.update({
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.ChannelSelect,
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
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      customId: `embed-builder/back`,
      emoji: cmd.client.util.emotes.back,
     },
    ],
   },
  ],
 });
};
