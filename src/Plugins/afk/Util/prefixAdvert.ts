import type { AfkSetting } from '@ayako/database';

import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import constants from '../../../Classes/Constants.js';
import { createCrossAdvert } from '../../../Util/crossAdvert.js';
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import stp from '../../../Util/stp.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import { mentionPrefix } from './matchPrefix.js';

const prefixLimit = 10;

const advert = async (invite: string) =>
 stp(en.settings.prefixAdvert, { invite, main: constants.standard.botAddUrl() });

export const prefixAdvert = createCrossAdvert<AfkSetting>({
 partner: PluginName.Ticketing,
 partnerKey: PluginBotKey.Ticketing,
 advert: async (_plugin, _stored, invite) => advert(invite),
 unavailable: async (_plugin, invite) => advert(invite),
 read: async (row) => row.prefix,
 write: async (value, row, ctx) => {
  const prefix = String(value ?? '').trim();
  const valid = mentionPrefix.test(prefix) || (prefix.length <= prefixLimit && !/\s/.test(prefix));
  if (!valid) {
   return { ok: false, reason: stp(en.settings.errors.prefix, { max: String(prefixLimit) }) };
  }

  await ctx.client.db.client.afkSetting.updateMany({
   where: { id: row.id, guild: row.guild },
   data: { prefix: prefix || null },
  });

  return { ok: true };
 },
});
