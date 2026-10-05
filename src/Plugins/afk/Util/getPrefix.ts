import type { RMessage } from '@ayako/utility';

import type Client from '../../../Classes/Client.js';
import Constants from '../../../Classes/Constants.js';
import GuildSetting from '../../settings/GuildSetting.js';

import { matchPrefix } from './matchPrefix.js';

export default async function (this: Client, msg: RMessage) {
 if (!msg.guild_id) return Constants.standard.prefix;
 if (!msg.content) return undefined;

 const afk = await this.db.client.afkSetting.findFirst({ where: { guild: msg.guild_id } });
 const custom = afk?.prefix ? matchPrefix(afk.prefix, msg.content) : undefined;
 if (custom) return custom;

 const base = new GuildSetting(this, msg.guild_id);
 const setting = await base.get();

 if (setting?.prefix && msg.content.toLowerCase().startsWith(setting.prefix.toLowerCase())) {
  return setting.prefix;
 }

 if (msg.content.toLowerCase().startsWith(Constants.standard.prefix.toLowerCase())) {
  return Constants.standard.prefix;
 }

 return undefined;
}
