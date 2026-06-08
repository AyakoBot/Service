import type Client from '../../../Classes/Client.js';
import TicketRoleMap from '../Classes/TicketRoleMap.js';

export const resolveStaffLabel = async function (
 this: Client,
 guildId: string,
 staffId: string,
 fallback: string,
): Promise<string> {
 const member = await this.cache.members.get(guildId, staffId);
 if (!member) return fallback;

 const entries = await new TicketRoleMap(this, guildId).list();
 if (!entries.length) return fallback;

 const held = new Set(member.roles);
 const match = entries.find((entry) => held.has(entry.role));
 if (!match) return fallback;

 if (match.label.trim()) return match.label;

 const role = await this.cache.roles.get(match.role);
 return role?.name || fallback;
};

export default resolveStaffLabel;
