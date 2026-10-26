import { TicketPriority } from '@ayako/database';

import en from '../Language/en-GB.json' with { type: 'json' };
import type TicketPlugin from '../Plugin.js';

export const priorityMeta = {
 [TicketPriority.None]: { key: 'priorityNone', rank: 0 },
 [TicketPriority.Low]: { key: 'priorityLow', rank: 1 },
 [TicketPriority.Medium]: { key: 'priorityMedium', rank: 2 },
 [TicketPriority.High]: { key: 'priorityHigh', rank: 3 },
 [TicketPriority.Urgent]: { key: 'priorityUrgent', rank: 4 },
} as const satisfies Record<TicketPriority, { key: keyof typeof en; rank: number }>;

export const priorityLabel = (
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 priority: TicketPriority,
): string => t[priorityMeta[priority].key]();

export const byUrgency = (
 a: { priority: TicketPriority; id: unknown },
 b: { priority: TicketPriority; id: unknown },
): number =>
 priorityMeta[b.priority].rank - priorityMeta[a.priority].rank || Number(a.id) - Number(b.id);
