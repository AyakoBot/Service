import type Plugin from '../Classes/abstracts/Plugin.js';
import { PluginName } from '../Classes/abstracts/Plugin.js';
import type Client from '../Classes/Client.js';
import constants from '../Classes/Constants.js';
import type {
 RowGuardContext,
 SettingsFieldVirtual,
 ShowIfResult,
} from '../Plugins/settings/SettingsSchema.js';

import { appIdOf } from './appIdTokens.js';
import { isBotPresent } from './botPresence.js';
import { PluginBotKey } from './pluginBotKey.js';

export interface CrossAdvertDef<Row> {
 partner: PluginName;
 partnerKey: PluginBotKey;
 advert: (plugin: Plugin, stored: unknown, invite: string) => Promise<string>;
 unavailable: (plugin: Plugin, invite: string) => Promise<string>;
 read: (row: Row, ctx: RowGuardContext) => Promise<unknown>;
 write: (value: unknown, row: Row, ctx: RowGuardContext) => Promise<ShowIfResult>;
}

export const partnerAvailable = async (
 client: Client,
 guildId: string,
 partner: PluginName,
 partnerKey: PluginBotKey,
): Promise<boolean> => {
 if (!client.plugins.some((plugin) => plugin.settingName === partner)) return false;
 if (await isBotPresent(client.cache, guildId, partnerKey)) return true;

 return isBotPresent(client.cache, guildId, PluginBotKey.Base);
};

export const inviteFor = (partnerKey: PluginBotKey): string =>
 constants.standard.botAddUrl(appIdOf(process.env[partnerKey] ?? '') ?? undefined);

export const createCrossAdvert = <Row>(def: CrossAdvertDef<Row>): SettingsFieldVirtual<Row> => ({
 prose: true,
 read: async (row, ctx) => {
  const stored = await def.read(row, ctx);
  const available = await partnerAvailable(ctx.client, ctx.guildId, def.partner, def.partnerKey);

  return available ? stored : def.advert(ctx.plugin, stored, inviteFor(def.partnerKey));
 },
 write: async (value, row, ctx) => {
  const available = await partnerAvailable(ctx.client, ctx.guildId, def.partner, def.partnerKey);
  if (!available) {
   return { ok: false, reason: await def.unavailable(ctx.plugin, inviteFor(def.partnerKey)) };
  }

  return def.write(value, row, ctx);
 },
});
