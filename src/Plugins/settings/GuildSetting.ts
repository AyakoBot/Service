import type { GuildSetting as GuildSettingRow } from '@ayako/database';

import type Client from '../../Classes/Client.js';

export default class GuildSetting {
 private client: Client;
 private where: { guildId: string };

 constructor(client: Client, guildId: string) {
  this.client = client;
  this.where = { guildId };
 }

 get(): Promise<GuildSettingRow | null> {
  return this.client.db.client.guildSetting.findUnique({ where: this.where });
 }
}
