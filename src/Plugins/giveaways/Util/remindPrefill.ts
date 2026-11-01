import formatDuration from '../../../Util/formatDuration.js';

const leadMs = 3600000;
const minuteMs = 60000;

export default (endTime: Date, now: number): string | null => {
 const remaining = Math.floor((endTime.getTime() - leadMs - now) / minuteMs) * minuteMs;
 return remaining > 0 ? formatDuration(remaining) : null;
};
