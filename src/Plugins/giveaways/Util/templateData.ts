import { Prisma, type GiveawayTemplate } from '@ayako/database';

import parseDuration from '../../../Util/parseDuration.js';

import { GiveawayErrors } from '../Classes/DBGiveaway.js';
import { GiveawayOption } from '../Classes/Routes.js';
import { maxBonusEntries, maxWinners } from '../constants.js';

import type { GiveawayDefaults } from './giveawayDefaults.js';
import type { GiveawayOptions } from './giveawayOptions.js';

export interface TemplatePlan {
 data: Record<string, unknown>;
 bonusRoles: string[];
 bonusExtra: number;
}

const positive = (value: unknown) => {
 const number = Number(value ?? 0);
 return Number.isFinite(number) && number > 0 ? number : null;
};

const clamp = (value: number, min: number, max: number) =>
 Math.min(max, Math.max(min, Math.round(value)));

export const withDefaults = (
 data: Record<string, unknown>,
 defaults: GiveawayDefaults,
 now = Date.now(),
): Record<string, unknown> => {
 const filled = { ...data };

 if (filled.endTime === undefined) {
  if (!defaults.durationSeconds) {
   throw new Error(GiveawayErrors.missingDefaults, { cause: [GiveawayOption.Time] });
  }
  filled.endTime = new Date(now + defaults.durationSeconds * 1000);
 }
 if (filled.winnerCount === undefined) filled.winnerCount = defaults.winnerCount;
 if (filled.collectSeconds === undefined) filled.collectSeconds = defaults.collectSeconds;

 return filled;
};

export const templatePlan = (
 template: GiveawayTemplate,
 defaults: GiveawayDefaults,
 now = Date.now(),
): TemplatePlan => {
 if (!template.description?.trim().length) throw new Error(GiveawayErrors.missingDescription);

 const duration = positive(template.duration);
 const winners = positive(template.winnerCount);

 return {
  data: withDefaults(
   {
    description: template.description,
    prize: template.prize?.length ? template.prize : null,
    ...(duration ? { endTime: new Date(now + duration * 1000) } : {}),
    ...(winners ? { winnerCount: clamp(winners, 1, maxWinners) } : {}),
    ...(positive(template.collectSeconds) ? { collectSeconds: template.collectSeconds } : {}),
    failReroll: template.failReroll,
    template: template.id,
    requiredRoles: template.requiredRoles,
    excludedRoles: template.excludedRoles,
    minAccountSeconds: template.minAccountSeconds,
    minTenureSeconds: template.minTenureSeconds,
    minMessages: template.minMessages,
    minMessagesSince: template.minMessagesSince,
    minVoiceSeconds: template.minVoiceSeconds,
    enforcement: template.enforcement,
    personalPrizes: template.personalPrizes,
    currency: positive(template.currency),
    winnerRoles: template.winnerRoles,
    banner: template.banner,
    thumbnail: template.thumbnail,
    accentColor: template.accentColor,
   },
   defaults,
   now,
  ),
  bonusRoles: template.bonusRoles,
  bonusExtra: clamp(Number(template.bonusExtra), 1, maxBonusEntries - 1),
 };
};

export const templateOverrides = (options: GiveawayOptions): Partial<GiveawayTemplate> => {
 const overrides: Partial<GiveawayTemplate> = {};

 if (options.description?.trim()) overrides.description = options.description;
 if (options.prize?.trim()) overrides.prize = options.prize;
 if (options.winners) overrides.winnerCount = new Prisma.Decimal(options.winners);
 if (options.time !== undefined) {
  const ms = parseDuration(options.time) ?? 0;
  if (ms <= 0) throw new Error(GiveawayErrors.invalidTime);
  overrides.duration = new Prisma.Decimal(Math.round(ms / 1000));
 }

 return overrides;
};
