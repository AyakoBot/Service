import type { TicketSetting } from '@ayako/database';
import { getGuildPerms } from '@ayako/utility';

import type Client from '../../../Classes/Client.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';

export default async function (
 this: Client,
 settings: TicketSetting,
 userId: string,
 roleIds: string[],
): Promise<boolean> {
 if (settings.staffUsers.includes(userId)) return true;
 if (settings.staffRoles.some((role) => roleIds.includes(role))) return true;

 return hasManageGuild((await getGuildPerms.call(this.cache, settings.guild, userId)).response);
}
