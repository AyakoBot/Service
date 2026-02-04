import type { RMessage } from '@ayako/utility';

import type Client from '../Classes/Client.js';
import Constants from '../Classes/Constants.js';
import GuildSetting from '../Plugins/settings/GuildSetting.js';

export default async function (this: Client, msg: RMessage) {
 if (!msg.guild_id) return Constants.standard.prefix;

 const base = new GuildSetting(this.db, msg.guild_id);
 const setting = await base.get();

 if (setting?.prefix && msg.content.toLowerCase().startsWith(setting.prefix.toLowerCase())) {
  return setting.prefix;
 }

 if (msg.content.toLowerCase().startsWith(Constants.standard.prefix.toLowerCase())) {
  return Constants.standard.prefix;
 }

 return undefined;
}
