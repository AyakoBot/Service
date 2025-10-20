import * as Discord from 'discord.js';

/**
 * Returns the true type of a Discord channel.
 * @param channel - The Discord channel to get the type of.
 * @param guild - The guild the channel belongs to.
 * @returns The true type of the channel.
 * @throws An error if the channel type is unknown.
 */
export default (channel: Discord.Channel | RChannel, guild: Discord.Guild) => {
 if (!channel) return 'Unknown';
 switch (channel?.type) {
  case ChannelType.GuildText: {
   switch (true) {
    case guild.rulesChannelId === channel.id:
     return 'Rules';
    case 'nsfw' in channel && channel.nsfw:
     return 'NSFWChannel';
    case !!channel.permissionOverwrites:
     return 'LockedChannel';
    default:
     return 'TextChannel';
   }
  }
  case ChannelType.DM: {
   return 'DM';
  }
  case ChannelType.GuildVoice: {
   switch (true) {
    case !!channel.permissionOverwrites:
     return 'LockedVoice';
    default:
     return 'Voice';
   }
  }
  case ChannelType.GroupDM:
   return 'GroupDm';
  case ChannelType.GuildCategory:
   return 'Category';
  case ChannelType.GuildAnnouncement:
   return 'NewsChannel';
  case ChannelType.AnnouncementThread:
  case ChannelType.PublicThread:
  case ChannelType.PrivateThread:
   return 'Thread';
  case ChannelType.GuildStageVoice:
   return 'Stage';
  case ChannelType.GuildDirectory as (typeof channel)['type']:
   return 'Directory';
  case ChannelType.GuildForum: {
   switch (true) {
    case 'nsfw' in channel && channel.nsfw:
     return 'NSFWForum';
    default:
     return 'Forum';
   }
  }
  case ChannelType.GuildMedia:
   return 'MediaChannel';
  default:
   throw new Error(
    // @ts-ignore
    `Unknown Channel Type: ${channel?.type} / ${channel ? ChannelType[channel.type] : ''}`,
   );
 }
};
