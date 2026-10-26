import { RequestHandlerError } from '@ayako/api';
import { GiveawayEnforcement, type Giveaway as GiveawayRow } from '@ayako/database';
import { txtFileWriter } from '@ayako/utility';
import {
 ActionRowBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import { InteractionType } from '@discordjs/core';
import {
 ApplicationCommandOptionType,
 MessageFlags,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type { UpdateData } from '../../../Types/prisma.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { findFocusedString } from '../../../Util/interactionOptions.js';
import { maxCountOptions, maxPrizeLength, origin, writeAttempts } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { bonusSnapshot, entriesFor } from '../Util/bonusEntries.js';
import { buildList, hasReward } from '../Util/container.js';
import { readOptions, toRowData } from '../Util/giveawayOptions.js';
import { buildPrizeModal, prizeSavedNote, readPrizeModal } from '../Util/prizeModal.js';
import renderGiveaway, { renderSoon } from '../Util/render.js';
import requireManager from '../Util/requireManager.js';
import { failedRequirements, needsActivity, requirementNote } from '../Util/requirements.js';

import DBGiveaway, { GiveawayErrors } from './DBGiveaway.js';
import { canReroll } from './GiveawayEngine.js';
import { GiveawayGroup, GiveawaysRoute, GiveawaySub } from './Routes.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;
type StateFilter = { ended?: boolean; cancelled?: boolean };

const emptyActivity = { messages: 0, messagesSince: 0, voiceSeconds: 0 };

const autocompleteState: Record<GiveawaySub | GiveawayGroup, StateFilter> = {
 [GiveawaySub.Quick]: {},
 [GiveawayGroup.Start]: {},
 [GiveawaySub.End]: { ended: false, cancelled: false },
 [GiveawaySub.Cancel]: { ended: false, cancelled: false },
 [GiveawaySub.Reroll]: { ended: true, cancelled: false },
 [GiveawaySub.Edit]: { cancelled: false },
 [GiveawaySub.List]: {},
 [GiveawaySub.Prizes]: { cancelled: false },
};

const focusedState = (cmd: APIApplicationCommandAutocompleteInteraction): StateFilter => {
 const top = cmd.data.options?.[0];
 if (!top || top.type !== ApplicationCommandOptionType.Subcommand) return {};

 return autocompleteState[top.name as GiveawaySub] ?? {};
};

export default class Giveaway extends DBGiveaway {
 static async list(plugin: GiveawaysPlugin, cmd: APIChatInputApplicationCommandInteraction) {
  const guildId = cmd.guild_id;
  if (!guildId) return;

  const payload = await Giveaway.listPayload(plugin, guildId, 0);
  payload.setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral).reply(cmd);
 }

 static async listPage(plugin: GiveawaysPlugin, cmd: APIMessageComponentInteraction, page: number) {
  const guildId = cmd.guild_id;
  if (!guildId || Number.isNaN(page)) return;

  const payload = await Giveaway.listPayload(plugin, guildId, page);
  payload.setFlags(MessageFlags.IsComponentsV2).update(cmd);
 }

 private static async listPayload(plugin: GiveawaysPlugin, guildId: string, page: number) {
  const t = await plugin.t(guildId);
  const api = await plugin.api(guildId);
  const emotes = plugin.client.emojis.for(api);

  const rows = await plugin.client.db.client.giveaway.findMany({
   where: { guild: guildId },
   orderBy: { message: 'desc' },
  });

  return new MessagePayload(plugin.client, { origin, reason: 'Giveaway list' }).setComponents(
   buildList.call(plugin, t, emotes, rows, page),
  );
 }

 static async autocomplete(
  plugin: GiveawaysPlugin,
  cmd: APIApplicationCommandAutocompleteInteraction,
 ) {
  if (!cmd.guild_id) return;

  const api = await plugin.api(cmd.guild_id);
  const query = findFocusedString(cmd.data.options).toLowerCase();

  const rows = await plugin.client.db.client.giveaway.findMany({
   where: { guild: cmd.guild_id, ...focusedState(cmd) },
   orderBy: { message: 'desc' },
  });

  const choices = rows
   .filter(
    (g) => !query || g.message.includes(query) || g.description.toLowerCase().includes(query),
   )
   .slice(0, 25)
   .map((g) => ({ name: g.description.slice(0, 100), value: g.message }));

  await api.interactions.createAutocompleteResponse(
   cmd.id,
   cmd.token,
   { choices },
   { origin: plugin.name, reason: 'Giveaway message-id autocomplete' },
  );
 }

 private t() {
  return this.plugin.t(this.guild);
 }

 private async subjectFor(giveaway: GiveawayRow, cmd: APIMessageComponentInteraction) {
  const userId = cmd.member?.user.id ?? '';
  const activity = needsActivity(giveaway)
   ? await this.plugin.activity.activityFor(this.guild, this.id, [userId])
   : new Map<string, typeof emptyActivity>();

  return {
   userId,
   roles: cmd.member?.roles ?? [],
   joinedAt: cmd.member?.joined_at ?? null,
   ...(activity.get(userId) ?? emptyActivity),
  };
 }

 private async enteredNote(roles: string[], reason: string | null) {
  const t = await this.t();
  if (reason) return t.participate.warned({ reason });

  const snapshot = await bonusSnapshot.call(this.plugin, this.id);
  const entries = entriesFor(roles, snapshot);

  return entries > 1
   ? `${t.participate.entered()} ${t.bonus.yours({ count: String(entries) })}`
   : t.participate.entered();
 }

 async participate(cmd: APIMessageComponentInteraction): Promise<number> {
  const userId = cmd.member?.user.id ?? '';
  const giveaway = await this.getRunning(GiveawayErrors.notFound);
  const t = await this.t();

  if (giveaway.participants.includes(userId)) {
   await this.leave(cmd, giveaway.participants, userId);

   ephemeralNote.call(this.plugin, cmd, t.participate.left());
   renderSoon.call(this.plugin, this.id);
   return 0;
  }

  const subject = await this.subjectFor(giveaway, cmd);
  const failed = failedRequirements(giveaway, subject);
  const reason = requirementNote(t, giveaway, failed);

  if (failed.length && giveaway.enforcement === GiveawayEnforcement.onJoin) {
   ephemeralNote.call(this.plugin, cmd, t.participate.refused({ reason: reason ?? '' }));
   return 0;
  }

  const joined = await super.participate(cmd, userId);
  if (!joined) await this.getRunning(GiveawayErrors.notFound);

  ephemeralNote.call(this.plugin, cmd, await this.enteredNote(subject.roles, reason));
  renderSoon.call(this.plugin, this.id);
  return joined;
 }

 async leave(
  cmd: APIMessageComponentInteraction,
  expected: string[],
  userId: string,
 ): Promise<number> {
  let participants = expected;

  for (let attempt = 0; attempt < writeAttempts; attempt += 1) {
   if (!participants.includes(userId)) return 0;

   const left = await super.leave(cmd, participants, userId);
   if (left) return left;

   ({ participants } = await this.getRunning(GiveawayErrors.notFound));
  }

  throw new Error(GiveawayErrors.busy);
 }

 private async prizeNote(giveaway: GiveawayRow, userId: string) {
  const t = await this.t();
  const reveal = await this.plugin.prizes.reveal(this.id, userId);
  const own = reveal.value
   ? t.claim.yours({ value: reveal.value })
   : reveal.listed
     ? t.claim.noneLeft({ host: `<@${giveaway.host}>` })
     : null;

  return [giveaway.prize ? t.claim.prize({ prize: giveaway.prize }) : null, own];
 }

 private async rewardNote(
  cmd: APIMessageComponentInteraction,
  giveaway: GiveawayRow,
  userId: string,
 ): Promise<string | null> {
  if (!Number(giveaway.currency ?? 0) && !giveaway.winnerRoles.length) return null;

  const first = await super.reward(cmd, userId);
  const rolesGiven = await this.plugin.rewards.grantRoles(giveaway, userId);
  const paid = first ? await this.plugin.rewards.payCurrency(giveaway, userId) : true;

  const t = await this.t();
  if (rolesGiven && paid) return t.claim.rewarded();

  await this.plugin.logs.rewardFailed(giveaway, userId);
  return t.claim.rewardFailed({ host: `<@${giveaway.host}>` });
 }

 async claim(cmd: APIMessageComponentInteraction): Promise<GiveawayRow> {
  const userId = cmd.member?.user.id ?? '';
  const giveaway = await this.getEnded(GiveawayErrors.notFound);
  if (!hasReward(giveaway)) throw new Error(GiveawayErrors.notFound);
  if (!giveaway.winners.includes(userId)) throw new Error(GiveawayErrors.notWinner);

  const notes = [
   ...(await this.prizeNote(giveaway, userId)),
   await this.rewardNote(cmd, giveaway, userId),
  ];
  ephemeralNote.call(this.plugin, cmd, notes.filter(Boolean).join('\n'));

  if (!giveaway.unclaimedWinners.includes(userId)) return giveaway;

  const unclaimedWinners = giveaway.unclaimedWinners.filter((w) => w !== userId);
  const done = !unclaimedWinners.length;

  const updated = await super.claim(cmd, unclaimedWinners, done);
  if (!done) return updated;

  await this.plugin.engine.disarmAll(giveaway);
  await this.plugin.engine.deleteAnnouncement(giveaway);
  await renderGiveaway.call(this.plugin, updated);
  return updated;
 }

 async end(cmd: APIChatInputApplicationCommandInteraction) {
  await this.getRunning(GiveawayErrors.notFoundOrEnded);

  const t = await this.t();
  ephemeralNote.call(this.plugin, cmd, t.end.manuallyEnded());

  await this.plugin.engine
   .end(this.id)
   .catch((e: Error) => this.plugin.nonFatalError(e, 'giveawayEnd'));
 }

 async cancel(cmd: APIChatInputApplicationCommandInteraction): Promise<GiveawayRow> {
  const giveaway = await this.getRunning(GiveawayErrors.notFoundOrEnded);

  const updated = await super.cancel(cmd);
  await this.plugin.engine.disarmAll(updated);
  await renderGiveaway.call(this.plugin, updated);
  await this.plugin.logs.cancelled(updated);

  const t = await this.t();
  const payload = new MessagePayload(this.client, { origin, reason: 'Giveaway cancelled' })
   .setContent(
    giveaway.participants.length
     ? `${t.cancel.done()} ${t.cancel.participantsFile()}`
     : t.cancel.done(),
   )
   .setFlags(MessageFlags.Ephemeral);

  if (giveaway.participants.length) {
   payload.addFiles(
    txtFileWriter([...new Set(giveaway.participants)].join('\n'), 'participants.txt'),
   );
  }

  payload.reply(cmd);
  return updated;
 }

 private async requirePrizesFor(giveaway: GiveawayRow, winners: number) {
  if (!giveaway.personalPrizes) return;

  const prizes = await this.plugin.prizes.total(this.id);
  if (prizes < winners) throw new Error(GiveawayErrors.prizesShort);
 }

 async edit(cmd: APIChatInputApplicationCommandInteraction, sub: Sub): Promise<GiveawayRow> {
  const giveaway = await this.getNotCancelled(GiveawayErrors.notFound);

  const options = readOptions(sub);
  if ('time' in options && giveaway.ended) throw new Error(GiveawayErrors.cannotExtendEnded);

  const data = toRowData(options) as UpdateData<'giveaway'>;
  if (!Object.keys(data).length) throw new Error(GiveawayErrors.noOptions);
  if ('winners' in options) await this.requirePrizesFor(giveaway, Number(data.winnerCount));

  let updated = await super.edit(cmd, sub, data);

  if ('time' in options && !updated.ended) await this.plugin.engine.armEnd(updated);
  if ('claimTimeout' in options && updated.ended && updated.unclaimedWinners.length) {
   updated = await this.plugin.engine.rearmClaim(updated);
  }
  await renderGiveaway.call(this.plugin, updated);

  const t = await this.t();
  ephemeralNote.call(this.plugin, cmd, t.edit.success());
  return updated;
 }

 async reroll(cmd: APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction) {
  if (cmd.type === InteractionType.MessageComponent) requireManager(cmd);

  const giveaway = await this.getEnded(GiveawayErrors.noEndedFound);
  if (!canReroll(giveaway)) throw new Error(GiveawayErrors.noEndedFound);

  if (giveaway.winners.length > 1) {
   await this.askRerollCount(cmd, giveaway.winners.length);
   return;
  }

  const t = await this.t();
  ephemeralNote.call(this.plugin, cmd, t.end.rerolling());

  await this.plugin.engine
   .reroll(this.id)
   .catch((e: Error) => this.plugin.nonFatalError(e, 'giveawayReroll'));
 }

 async rerollCount(cmd: APIMessageComponentSelectMenuInteraction) {
  const count = Number(cmd.data.values[0]);
  if (!count) return;

  const t = await this.t();
  const ok = await this.plugin.engine.reroll(this.id, count);

  new MessagePayload(this.client, { origin, reason: 'Giveaway reroll' })
   .setContent(ok ? t.end.rerolling() : t.errors.noEndedFound())
   .setComponents([])
   .update(cmd);
 }

 async openPrizes(cmd: APIChatInputApplicationCommandInteraction) {
  requireManager(cmd);

  const giveaway = await this.getNotCancelled(GiveawayErrors.notFound);
  const [open, revealed] = await Promise.all([
   this.plugin.prizes.open(this.id),
   this.plugin.prizes.revealedCount(this.id),
  ]);

  const t = await this.t();
  const modal = buildPrizeModal(
   t,
   this.plugin.getRoute(GiveawaysRoute.Prizes, this.id),
   giveaway.prize,
   open.map((row) => row.value),
   revealed,
  );

  const api = await this.plugin.api(this.guild);
  const opened = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
   origin,
   reason: 'Opening giveaway prizes',
  });
  if (opened instanceof RequestHandlerError) this.plugin.nonFatalError(opened, 'giveawayPrizes');
 }

 async savePrizes(cmd: APIModalSubmitInteraction): Promise<GiveawayRow> {
  requireManager(cmd);

  const form = readPrizeModal(cmd.data.components);
  if (!form.prize.length) throw new Error(GiveawayErrors.missingPrize);
  if (form.values.some((value) => value.length > maxPrizeLength)) {
   throw new Error(GiveawayErrors.prizeTooLong);
  }

  const giveaway = await this.getNotCancelled(GiveawayErrors.notFound);
  if (giveaway.personalPrizes) {
   const revealed = await this.plugin.prizes.revealedCount(this.id);
   if (revealed + form.values.length < Number(giveaway.winnerCount)) {
    throw new Error(GiveawayErrors.prizesShort);
   }
  }

  const updated = await super.savePrizes(cmd, form.prize);

  await this.plugin.prizes.replace(this.id, form.values);
  if (updated.ended) await this.plugin.prizes.sync(this.id);
  await renderGiveaway.call(this.plugin, updated);

  const t = await this.t();
  ephemeralNote.call(
   this.plugin,
   cmd,
   prizeSavedNote(t, form.values.length, Number(updated.winnerCount)),
  );
  return updated;
 }

 private async askRerollCount(
  cmd: APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction,
  maxRerollable: number,
 ) {
  const t = await this.t();

  const select = new StringSelectMenuBuilder()
   .setCustomId(this.plugin.getRoute(GiveawaysRoute.RerollCount, this.id))
   .setPlaceholder(t.end.howManyPlaceholder())
   .addOptions(
    Array.from({ length: Math.min(maxRerollable, maxCountOptions) }, (_, i) =>
     new StringSelectMenuOptionBuilder().setLabel(String(i + 1)).setValue(String(i + 1)),
    ),
   );

  new MessagePayload(this.client, { origin, reason: 'Giveaway reroll' })
   .setContent(t.end.howMany({ count: String(maxRerollable) }))
   .setComponents([new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select).toJSON()])
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
 }
}
