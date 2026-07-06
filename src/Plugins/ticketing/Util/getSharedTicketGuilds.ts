import type { TicketSetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

export interface CandidateGuild {
 guildId: string;
 kinds: TicketSetting[];
}

export default async function (
 this: Client,
 userId: string,
 scopeGuildIds?: string[],
): Promise<CandidateGuild[]> {
 const where: { active: true; dmEnabled: true; guild?: { in: string[] } } = {
  active: true,
  dmEnabled: true,
 };
 if (scopeGuildIds?.length) where.guild = { in: scopeGuildIds };

 const settings = await this.db.client.ticketSetting.findMany({ where });
 if (!settings.length) return [];

 const byGuild = new Map<string, TicketSetting[]>();
 settings.forEach((setting) => {
  const list = byGuild.get(setting.guild) ?? [];
  list.push(setting);
  byGuild.set(setting.guild, list);
 });

 const candidates: CandidateGuild[] = [];

 for (const [guildId, kinds] of byGuild) {
  const member = await this.cache.members.get(guildId, userId);
  if (!member) continue;

  const roleIds = member.roles ?? [];
  const openable = kinds.filter(
   (kind) =>
    !kind.denyUsers.includes(userId) && !kind.denyRoles.some((r) => roleIds.includes(r)),
  );
  if (!openable.length) continue;

  candidates.push({ guildId, kinds: openable });
 }

 return candidates;
}
