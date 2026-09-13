import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { getIntegerOption, getUserOption } from '../../../../Util/interactionOptions.js';
import { EconomyOption } from '../../Classes/Commands.js';
import { LedgerReason } from '../../Classes/Enums.js';
import type EconomyPlugin from '../../Plugin.js';
import { rootOptions } from '../../Util/rootOptions.js';

export default async function (this: EconomyPlugin, cmd: APIChatInputApplicationCommandInteraction) {
 const guildId = cmd.guild_id!;
 const sender = cmd.member?.user.id ?? cmd.user?.id ?? '';
 const sub = rootOptions(cmd);
 const target = getUserOption(sub, EconomyOption.User);
 const amount = getIntegerOption(sub, EconomyOption.Amount) ?? 0;

 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);
 const symbol = this.symbolOf(settings);

 if (!settings.active) return ephemeralNote.call(this, cmd, t.errors.inactive());
 if (settings.frozen) return ephemeralNote.call(this, cmd, t.errors.frozen());
 if (!settings.transferActive) return ephemeralNote.call(this, cmd, t.pay.disabled());
 if (!target || target === sender) return ephemeralNote.call(this, cmd, t.pay.self());

 if (cmd.data.resolved && 'users' in cmd.data.resolved && cmd.data.resolved.users?.[target]?.bot) {
  return ephemeralNote.call(this, cmd, t.pay.botTarget());
 }

 if (amount < Math.max(1, settings.transferMin)) {
  return ephemeralNote.call(
   this,
   cmd,
   t.pay.tooLow({ min: String(Math.max(1, settings.transferMin)), symbol }),
  );
 }
 if (settings.transferMax > 0 && amount > settings.transferMax) {
  return ephemeralNote.call(this, cmd, t.pay.tooHigh({ max: String(settings.transferMax), symbol }));
 }

 const allowance = await this.bank.transferAllowance(guildId, sender);
 if (amount > allowance) {
  return ephemeralNote.call(this, cmd, t.pay.capReached({ remaining: String(allowance), symbol }));
 }

 if (!(await this.bank.debit(guildId, sender, amount))) {
  return ephemeralNote.call(this, cmd, t.pay.insufficient());
 }

 const tax = Math.floor((amount * Math.max(0, Math.min(100, settings.transferTax))) / 100);
 const net = amount - tax;

 await this.bank.credit(guildId, target, net);
 await this.bank.noteTransfer(guildId, sender, amount);

 await this.economyLog.record({
  guildId,
  userId: sender,
  amount: -amount,
  reason: LedgerReason.TransferOut,
  executorId: sender,
 });
 await this.economyLog.record({
  guildId,
  userId: target,
  amount: net,
  reason: LedgerReason.TransferIn,
  executorId: sender,
 });

 const sent = t.pay.sent({ amount: String(net), symbol, user: `<@${target}>` });
 const suffix = tax > 0 ? `\n-# ${t.pay.taxed({ tax: String(tax), symbol })}` : '';

 return ephemeralNote.call(this, cmd, `${sent}${suffix}`);
}
