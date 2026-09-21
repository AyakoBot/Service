import { appIdOf } from '../../../Util/appIdTokens.js';
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { FleetBot } from './Commands.js';

export interface FleetEntry {
 bot: FleetBot;
 tokenKey: PluginBotKey;
 appId: string | null;
}

const bots: { bot: FleetBot; tokenKey: PluginBotKey }[] = [
 { bot: FleetBot.Base, tokenKey: PluginBotKey.Base },
 { bot: FleetBot.Info, tokenKey: PluginBotKey.Info },
 { bot: FleetBot.Afk, tokenKey: PluginBotKey.Afk },
 { bot: FleetBot.Rp, tokenKey: PluginBotKey.Rp },
 { bot: FleetBot.Ticketing, tokenKey: PluginBotKey.Ticketing },
 { bot: FleetBot.Economy, tokenKey: PluginBotKey.Economy },
 { bot: FleetBot.CustomRoles, tokenKey: PluginBotKey.CustomRoles },
 { bot: FleetBot.Welcome, tokenKey: PluginBotKey.Welcome },
];

export const fleetEntries = (): FleetEntry[] =>
 bots.map((entry) => {
  const token = process.env[entry.tokenKey];

  return {
   ...entry,
   appId: token ? appIdOf(token) : null,
  };
 });
