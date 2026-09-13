import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import {
 getIntegerOption,
 getStringOption,
 getSubcommand,
 getUserOption,
} from '../../../../Util/interactionOptions.js';
import { EconomyOption, EconomySubcommand } from '../../Classes/Commands.js';
import { LedgerReason } from '../../Classes/Enums.js';
import type EconomyPlugin from '../../Plugin.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;
type Handler = (
 this: EconomyPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 sub: Sub,
) => Promise<void>;

const boardSize = 10;

const executorOf = (cmd: APIChatInputApplicationCommandInteraction): string =>
 cmd.member?.user.id ?? cmd.user?.id ?? '';

const adjust: (sign: 1 | -1, reason: LedgerReason) => Handler =
 (sign, reason) =>
  async function (this: EconomyPlugin, cmd, sub) {
   const guildId = cmd.guild_id!;
   const t = await this.t(guildId);
   const settings = await this.bank.settings(guildId);
   const symbol = this.symbolOf(settings);

   const target = getUserOption(sub, EconomyOption.User);
   const amount = getIntegerOption(sub, EconomyOption.Amount) ?? 0;
   const note = getStringOption(sub, EconomyOption.Reason);
   if (!target || amount <= 0) return;

   if (sign === 1) await this.bank.credit(guildId, target, amount);
   else await this.bank.debit(guildId, target, amount);

   await this.economyLog.record({
    guildId,
    userId: target,
    amount: sign * amount,
    reason,
    executorId: executorOf(cmd),
    note: note || undefined,
   });

   const text =
    sign === 1
     ? t.admin.given({ amount: String(amount), symbol, user: `<@${target}>` })
     : t.admin.taken({ amount: String(amount), symbol, user: `<@${target}>` });

   ephemeralNote.call(this, cmd, text);
  };

const setExact: Handler = async function (this: EconomyPlugin, cmd, sub) {
 const guildId = cmd.guild_id!;
 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);
 const symbol = this.symbolOf(settings);

 const target = getUserOption(sub, EconomyOption.User);
 const amount = getIntegerOption(sub, EconomyOption.Amount) ?? 0;
 const note = getStringOption(sub, EconomyOption.Reason);
 if (!target) return;

 const applied = await this.bank.setBalance(guildId, target, amount);

 await this.economyLog.record({
  guildId,
  userId: target,
  amount: applied,
  reason: LedgerReason.AdminSet,
  executorId: executorOf(cmd),
  note: note || undefined,
 });

 ephemeralNote.call(
  this,
  cmd,
  t.admin.setTo({ amount: String(applied), symbol, user: `<@${target}>` }),
 );
};

const reset: Handler = async function (this: EconomyPlugin, cmd, sub) {
 const guildId = cmd.guild_id!;
 const t = await this.t(guildId);
 const target = getUserOption(sub, EconomyOption.User);
 const note = getStringOption(sub, EconomyOption.Reason);
 if (!target) return;

 await this.bank.setBalance(guildId, target, 0);

 await this.economyLog.record({
  guildId,
  userId: target,
  amount: 0,
  reason: LedgerReason.AdminReset,
  executorId: executorOf(cmd),
  note: note || undefined,
 });

 ephemeralNote.call(this, cmd, t.admin.reset({ user: `<@${target}>` }));
};

const freeze: Handler = async function (this: EconomyPlugin, cmd) {
 const guildId = cmd.guild_id!;
 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);

 await this.client.db.client.economySetting.update({
  where: { guild: guildId },
  data: { frozen: !settings.frozen },
 });

 ephemeralNote.call(this, cmd, settings.frozen ? t.admin.unfrozen() : t.admin.frozen());
};

export const leaderboard = async function (
 this: EconomyPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 const guildId = cmd.guild_id!;
 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);
 const symbol = this.symbolOf(settings);

 const rows = await this.bank.top(guildId, boardSize);
 if (!rows.length) {
  ephemeralNote.call(this, cmd, t.board.empty());
  return;
 }

 const lines = rows.map(
  (row, index) =>
   `**${index + 1}.** <@${row.user}> ${row.balance.toLocaleString('en-GB')} ${symbol}`,
 );
 const rank = await this.bank.rankOf(guildId, executorOf(cmd));

 ephemeralNote.call(
  this,
  cmd,
  `**${t.board.title()}**\n${lines.join('\n')}\n-# ${t.board.you({ rank: String(rank) })}`,
 );
};

const routes: Partial<Record<EconomySubcommand, Handler>> = {
 [EconomySubcommand.Give]: adjust(1, LedgerReason.AdminGive),
 [EconomySubcommand.Take]: adjust(-1, LedgerReason.AdminTake),
 [EconomySubcommand.Set]: setExact,
 [EconomySubcommand.Reset]: reset,
 [EconomySubcommand.Freeze]: freeze,
 [EconomySubcommand.Leaderboard]: leaderboard,
};

export default async function (this: EconomyPlugin, cmd: APIChatInputApplicationCommandInteraction) {
 const sub = getSubcommand(cmd);
 if (!sub) return;

 const t = await this.t(cmd.guild_id!);
 const settings = await this.bank.settings(cmd.guild_id!);

 if (!settings.active && sub.name !== EconomySubcommand.Freeze) {
  ephemeralNote.call(this, cmd, t.errors.inactive());
  return;
 }

 await routes[sub.name as EconomySubcommand]?.call(this, cmd, sub);
}
