import type { TicketSetting } from '@ayako/database';

import type TicketPlugin from '../Plugin.js';

export const systemDisplayLabel = (
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 row: TicketSetting,
): string => row.name || t.settings.systemLabel({ id: `#${String(row.id).slice(-4)}` });
