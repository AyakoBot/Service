import { ChannelType, PermissionFlagsBits } from '@discordjs/core';

export const GuildTextChannelTypes = [
 ChannelType.AnnouncementThread,
 ChannelType.GuildAnnouncement,
 ChannelType.GuildStageVoice,
 ChannelType.GuildText,
 ChannelType.GuildVoice,
 ChannelType.PrivateThread,
 ChannelType.PublicThread,
] as const;

export const AllNonThreadGuildChannelTypes = [
 ChannelType.GuildAnnouncement,
 ChannelType.GuildStageVoice,
 ChannelType.GuildText,
 ChannelType.GuildVoice,
 ChannelType.GuildForum,
 ChannelType.GuildMedia,
] as const;

export const AllThreadGuildChannelTypes = [
 ChannelType.PublicThread,
 ChannelType.PrivateThread,
 ChannelType.AnnouncementThread,
] as const;

export const ChannelBanBits = [
 PermissionFlagsBits.SendMessages,
 PermissionFlagsBits.SendMessagesInThreads,
 PermissionFlagsBits.ViewChannel,
 PermissionFlagsBits.AddReactions,
 PermissionFlagsBits.Connect,
] as const;
