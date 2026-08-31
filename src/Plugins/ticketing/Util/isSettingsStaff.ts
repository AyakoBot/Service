import type { TicketSetting } from '@ayako/database';

export default function (settings: TicketSetting, userId: string, roleIds: string[]): boolean {
 if (settings.staffUsers.includes(userId)) return true;

 return settings.staffRoles.some((role) => roleIds.includes(role));
}
