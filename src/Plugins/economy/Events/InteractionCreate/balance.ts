import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../Util/respond.js';
import { getUserOption } from '../../../../Util/interactionOptions.js';
import { EconomyOption } from '../../Classes/Commands.js';
import type EconomyPlugin from '../../Plugin.js';
import { rootOptions } from '../../Util/rootOptions.js';

export default async function (this: EconomyPlugin, cmd: APIChatInputApplicationCommandInteraction) {
 const guildId = cmd.guild_id!;
 const self = cmd.member?.user.id ?? cmd.user?.id ?? '';
 const target = getUserOption(rootOptions(cmd), EconomyOption.User) ?? self;

 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);

 if (!settings.active) {
  ephemeralNote.call(this, cmd, t.errors.inactive());
  return;
 }
 if (target !== self && !settings.balancePublic) {
  ephemeralNote.call(this, cmd, t.balance.private());
  return;
 }

 const symbol = this.symbolOf(settings);
 const amount = await this.bank.balanceOf(guildId, target);
 const rank = await this.bank.rankOf(guildId, target);

 const body =
  target === self
   ? t.balance.yours({ amount: String(amount), symbol })
   : t.balance.theirs({ user: `<@${target}>`, amount: String(amount), symbol });

 ephemeralNote.call(this, cmd, `${body}\n-# ${t.balance.rank({ rank: String(rank) })}`);
}
