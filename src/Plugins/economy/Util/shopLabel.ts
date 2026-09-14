import type { EconomyRoleReward } from '@ayako/database';

import type EconomyPlugin from '../Plugin.js';

export const shopLabel = async function (
 this: EconomyPlugin,
 row: EconomyRoleReward,
 fallback: string,
): Promise<string> {
 const roleId = row.purchaseRoles[0];
 if (!roleId) return fallback;

 const role = await this.client.cache.roles.get(roleId);

 return role?.name ?? fallback;
};
