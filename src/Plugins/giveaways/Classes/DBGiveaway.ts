import type { Giveaway as GiveawayRow } from '@ayako/database';
import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
 APIMessageComponentInteraction,
 APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type { CreateData, UpdateData } from '../../../Types/prisma.js';
import type GiveawaysPlugin from '../Plugin.js';

/* eslint-disable @typescript-eslint/naming-convention */
export enum GiveawayErrors {
 notFound = 'notFound',
 notFoundOrEnded = 'notFoundOrEnded',
 noEndedFound = 'noEndedFound',
 youNoPerms = 'youNoPerms',
 missingPerms = 'missingPerms',
 invalidTime = 'invalidTime',
 missingDefaults = 'missingDefaults',
 collectTooShort = 'collectTooShort',
 notWinner = 'notWinner',
 noOptions = 'noOptions',
 missingDescription = 'missingDescription',
 cannotExtendEnded = 'cannotExtendEnded',
 invalidUrl = 'invalidUrl',
 invalidColor = 'invalidColor',
 invalidDesign = 'invalidDesign',
 designTooLarge = 'designTooLarge',
 busy = 'busy',
 missingPrize = 'missingPrize',
 prizeTooLong = 'prizeTooLong',
 invalidExtra = 'invalidExtra',
 activityOff = 'activityOff',
 templateNotFound = 'templateNotFound',
 templateNameTaken = 'templateNameTaken',
 templateNoChannel = 'templateNoChannel',
 prizesShort = 'prizesShort',
 alreadyStarted = 'alreadyStarted',
 repeatTooShort = 'repeatTooShort',
 tooManyRecurring = 'tooManyRecurring',
 recurringNeedsLog = 'recurringNeedsLog',
 invalidWinners = 'invalidWinners',
 overridesPersonalPrizes = 'overridesPersonalPrizes',
}
/* eslint-enable @typescript-eslint/naming-convention */

export default abstract class DBGiveaway {
 plugin: GiveawaysPlugin;
 guild: string;
 id: string;
 protected client: Client;

 constructor(plugin: GiveawaysPlugin, messageId: string, guildId: string) {
  this.client = plugin.client;
  this.plugin = plugin;
  this.guild = guildId;
  this.id = messageId;
 }

 protected async getRow(
  filter: { ended?: boolean; cancelled: boolean },
  error: GiveawayErrors,
 ): Promise<GiveawayRow> {
  const row = await this.client.db.client.giveaway.findFirst({
   where: { message: this.id, guild: this.guild, ...filter },
  });
  if (!row) throw new Error(error);
  return row;
 }

 getRunning(error: GiveawayErrors): Promise<GiveawayRow> {
  return this.getRow({ ended: false, cancelled: false }, error);
 }

 getEnded(error: GiveawayErrors): Promise<GiveawayRow> {
  return this.getRow({ ended: true, cancelled: false }, error);
 }

 getNotCancelled(error: GiveawayErrors): Promise<GiveawayRow> {
  return this.getRow({ cancelled: false }, error);
 }

 register(data: CreateData<'giveaway'>): Promise<GiveawayRow> {
  return this.client.db.client.giveaway.create({ data });
 }

 participate(_cmd: APIMessageComponentInteraction, userId: string): Promise<number> {
  return this.client.db.client.giveaway
   .updateMany({
    where: {
     message: this.id,
     ended: false,
     cancelled: false,
     NOT: { participants: { has: userId } },
    },
    data: { participants: { push: userId } },
   })
   .then((result) => result.count);
 }

 leave(_cmd: APIMessageComponentInteraction, expected: string[], userId: string): Promise<number> {
  return this.client.db.client.giveaway
   .updateMany({
    where: { message: this.id, participants: { equals: expected } },
    data: { participants: expected.filter((p) => p !== userId) },
   })
   .then((result) => result.count);
 }

 reward(_cmd: APIMessageComponentInteraction, userId: string): Promise<number> {
  return this.client.db.client.giveaway
   .updateMany({
    where: { message: this.id, NOT: { rewarded: { has: userId } } },
    data: { rewarded: { push: userId } },
   })
   .then((result) => result.count);
 }

 savePrizes(_cmd: APIModalSubmitInteraction, prize: string): Promise<GiveawayRow> {
  return this.client.db.client.giveaway.update({ where: { message: this.id }, data: { prize } });
 }

 claim(
  _cmd: APIMessageComponentInteraction,
  unclaimedWinners: string[],
  done: boolean,
 ): Promise<GiveawayRow> {
  return this.client.db.client.giveaway.update({
   where: { message: this.id },
   data: {
    unclaimedWinners,
    claimingDone: done,
    ...(done ? { announceMessage: null } : {}),
   },
  });
 }

 cancel(_cmd: APIChatInputApplicationCommandInteraction): Promise<GiveawayRow> {
  return this.client.db.client.giveaway.update({
   where: { message: this.id },
   data: { ended: true, cancelled: true },
  });
 }

 edit(
  _cmd: APIChatInputApplicationCommandInteraction,
  _sub: APIApplicationCommandInteractionDataSubcommandOption,
  data: UpdateData<'giveaway'>,
 ): Promise<GiveawayRow> {
  return this.client.db.client.giveaway.update({ where: { message: this.id }, data });
 }
}
