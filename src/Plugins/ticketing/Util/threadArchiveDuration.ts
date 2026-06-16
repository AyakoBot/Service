import { ThreadArchiveDuration } from '@ayako/database';
import { ThreadAutoArchiveDuration } from 'discord-api-types/v10';

export const threadArchiveMinutes: Record<ThreadArchiveDuration, ThreadAutoArchiveDuration> = {
 [ThreadArchiveDuration.OneHour]: ThreadAutoArchiveDuration.OneHour,
 [ThreadArchiveDuration.OneDay]: ThreadAutoArchiveDuration.OneDay,
 [ThreadArchiveDuration.ThreeDays]: ThreadAutoArchiveDuration.ThreeDays,
 [ThreadArchiveDuration.OneWeek]: ThreadAutoArchiveDuration.OneWeek,
};
