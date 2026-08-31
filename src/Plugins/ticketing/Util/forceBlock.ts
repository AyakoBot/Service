import type Client from '../../../Classes/Client.js';

const forceBlockHours = 24;

export const isForceBlocked = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<boolean> {
 const block = await this.db.client.ticketForceBlock.findUnique({
  where: { guild_user: { guild: guildId, user: userId } },
 });

 return !!block && block.until.getTime() > Date.now();
};

export const setForceBlock = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<void> {
 const until = new Date(Date.now() + forceBlockHours * 60 * 60 * 1000);

 await this.db.client.ticketForceBlock.upsert({
  where: { guild_user: { guild: guildId, user: userId } },
  create: { guild: guildId, user: userId, until },
  update: { until },
 });
};
