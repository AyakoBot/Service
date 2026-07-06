import formatDuration from './formatDuration.js';
import parseDuration from './parseDuration.js';

export const parseDurationSeconds = (raw: string): number | null => {
 const milliseconds = parseDuration(raw);
 return milliseconds === null ? null : Math.round(milliseconds / 1000);
};

export const formatDurationSeconds = (seconds: number): string =>
 (seconds > 0 ? formatDuration(seconds * 1000) : '');
