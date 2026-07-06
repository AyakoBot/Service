import type { APIPartialEmoji } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import TicketRoleMap from '../Classes/TicketRoleMap.js';

export const resolveStaffLabel = async function (
 this: Client,
 guildId: string,
 staffId: string,
 fallback: {
  name: string;
  emote: APIPartialEmoji | undefined;
 },
): Promise<{
 name: string;
 emote: APIPartialEmoji | undefined;
}> {
 const member = await this.cache.members.get(guildId, staffId);
 if (!member) return fallback;

 const entries = await new TicketRoleMap(this, guildId).list();
 if (!entries.length) return fallback;

 const held = new Set(member.roles);
 const match = entries.find((entry) => held.has(entry.role));
 if (!match) return fallback;

 if (match.label.trim()) return { name: match.label, emote: fallback.emote };

 const role = await this.cache.roles.get(match.role);
 return role ? { name: role.name, emote: fallback.emote } : fallback;
};
