import { RequestHandlerError } from '@ayako/api';
import type { Giveaway } from '@ayako/database';

import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import type Client from '../../../Classes/Client.js';
import type EconomyPlugin from '../../economy/Plugin.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

export default class GiveawayRewards {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 grantRoles = async (giveaway: Giveaway, userId: string): Promise<boolean> => {
  if (!giveaway.winnerRoles.length) return true;

  const api = await this.plugin.api(giveaway.guild);
  const results = await Promise.all(
   giveaway.winnerRoles.map((role) =>
    api.guilds.addRoleToMember(giveaway.guild, userId, role, {
     origin,
     reason: 'Giveaway winner role',
    }),
   ),
  );

  return results.every((result) => !(result instanceof RequestHandlerError));
 };

 revokeRoles = async (giveaway: Giveaway, userIds: string[]) => {
  if (!giveaway.winnerRoles.length || !userIds.length) return;

  const api = await this.plugin.api(giveaway.guild);
  for (const userId of userIds) {
   for (const role of giveaway.winnerRoles) {
    const removed = await api.guilds.removeRoleFromMember(giveaway.guild, userId, role, {
     origin,
     reason: 'Giveaway winner rerolled',
    });
    if (removed instanceof RequestHandlerError)
     this.plugin.nonFatalError(removed, 'revokeWinnerRole');
   }
  }
 };

 payCurrency = async (giveaway: Giveaway, userId: string): Promise<boolean> => {
  const amount = Math.round(Number(giveaway.currency ?? 0));
  if (amount <= 0) return true;

  const economy = this.client.plugins.find(
   (plugin) => plugin.settingName === PluginName.Economy,
  ) as EconomyPlugin | undefined;
  if (!economy?.isEnabled()) return false;

  await economy.bank.credit(giveaway.guild, userId, amount);
  return true;
 };
}
