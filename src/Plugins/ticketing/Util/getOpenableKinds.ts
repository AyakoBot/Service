import type { TicketSetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

import isUnderLimit from './isUnderLimit.js';

export interface OpenableKind {
 settings: TicketSetting;
 existingTicketId: string | null;
}

export default async function (
 this: Client,
 guildId: string,
 userId: string,
 roleIds: string[],
): Promise<OpenableKind[]> {
 const settings = await this.db.client.ticketSetting.findMany({
  where: { guild: guildId, active: true, dmEnabled: true },
 });

 const openable: OpenableKind[] = [];

 for (const setting of settings) {
  if (setting.denyUsers.includes(userId)) continue;
  if (setting.denyRoles.some((r) => roleIds.includes(r))) continue;

  const limit = await isUnderLimit.call(this, setting, userId);
  openable.push({ settings: setting, existingTicketId: limit.ok ? null : limit.ticketId });
 }

 return openable;
}
