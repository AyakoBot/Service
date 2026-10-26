import { ChannelType } from 'discord-api-types/v10';

import { MessagePlaceholder, withServerPlaceholders } from '../../Util/messagePlaceholders.js';

export const giveawayChannelTypes = [
 ChannelType.GuildAnnouncement,
 ChannelType.GuildText,
 ChannelType.GuildVoice,
 ChannelType.GuildStageVoice,
 ChannelType.PublicThread,
 ChannelType.PrivateThread,
 ChannelType.AnnouncementThread,
] as const;

export const origin = 'Giveaways';
export const listPageSize = 10;
export const maxCountOptions = 25;
export const minCollectMs = 3600000;
export const coalesceMs = 3000;
export const maxBonusEntries = 100;
export const maxListed = 20;
export const maxWinners = 100;
export const designReserve = 3;
export const writeAttempts = 5;
export const maxPrizeLength = 900;
export const minRepeatSeconds = 3600;
export const maxRecurring = 10;
export const panelLockMs = 86400000;

export const giveawayPlaceholders = withServerPlaceholders(
 MessagePlaceholder.Prize,
 MessagePlaceholder.Time,
 MessagePlaceholder.Winners,
 MessagePlaceholder.Entries,
 MessagePlaceholder.Host,
);
