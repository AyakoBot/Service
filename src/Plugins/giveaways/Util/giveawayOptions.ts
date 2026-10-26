import type { APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10';

import type { UpdateData } from '../../../Types/prisma.js';
import {
 getBooleanOption,
 getChannelOption,
 getIntegerOption,
 getRoleOption,
 getStringOption,
 getUserOption,
 hasOption,
} from '../../../Util/interactionOptions.js';
import parseDuration from '../../../Util/parseDuration.js';
import { GiveawayErrors } from '../Classes/DBGiveaway.js';
import { GiveawayOption } from '../Classes/Routes.js';
import { minCollectMs } from '../constants.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;

export interface GiveawayOptions {
 description?: string;
 time?: string;
 winners?: number | null;
 channel?: string | null;
 role?: string | null;
 host?: string | null;
 prize?: string;
 claimTimeout?: string;
 failReroll?: boolean;
}

type OptionReader = { option: GiveawayOption; read: (sub: Sub) => unknown };

const optionReaders: Record<keyof GiveawayOptions, OptionReader> = {
 description: {
  option: GiveawayOption.Description,
  read: (sub) => getStringOption(sub, GiveawayOption.Description),
 },
 time: { option: GiveawayOption.Time, read: (sub) => getStringOption(sub, GiveawayOption.Time) },
 winners: {
  option: GiveawayOption.Winners,
  read: (sub) => getIntegerOption(sub, GiveawayOption.Winners),
 },
 channel: {
  option: GiveawayOption.Channel,
  read: (sub) => getChannelOption(sub, GiveawayOption.Channel),
 },
 role: { option: GiveawayOption.Role, read: (sub) => getRoleOption(sub, GiveawayOption.Role) },
 host: { option: GiveawayOption.Host, read: (sub) => getUserOption(sub, GiveawayOption.Host) },
 prize: { option: GiveawayOption.Prize, read: (sub) => getStringOption(sub, GiveawayOption.Prize) },
 claimTimeout: {
  option: GiveawayOption.ClaimTimeout,
  read: (sub) => getStringOption(sub, GiveawayOption.ClaimTimeout),
 },
 failReroll: {
  option: GiveawayOption.FailReroll,
  read: (sub) => getBooleanOption(sub, GiveawayOption.FailReroll, false),
 },
};

export const readOptions = (sub: Sub): GiveawayOptions =>
 Object.fromEntries(
  Object.entries(optionReaders)
   .filter(([, entry]) => hasOption(sub, entry.option))
   .map(([key, entry]) => [key, entry.read(sub)])
   .filter(([, value]) => value !== null),
 ) as GiveawayOptions;

const clearWords = ['', 'none', '0'];

const cleared = (raw: string) => clearWords.includes(raw.trim().toLowerCase());

export const durationSeconds = (raw: string | undefined, minMs = 0) => {
 if (raw === undefined) return undefined;
 if (cleared(raw)) return null;

 const ms = parseDuration(raw) ?? 0;
 if (ms <= 0) throw new Error(GiveawayErrors.invalidTime);
 if (ms < minMs) throw new Error(GiveawayErrors.collectTooShort);

 return Math.round(ms / 1000);
};

const set = <T>(data: Record<string, unknown>, column: string, value: T | undefined) => {
 if (value !== undefined) data[column] = value;
};

export const toRowData = (options: GiveawayOptions): UpdateData<'giveaway'> => {
 const data: Record<string, unknown> = {};

 set(data, 'description', options.description);
 set(data, 'host', options.host ?? undefined);
 set(data, 'failReroll', options.failReroll);

 if ('winners' in options) data.winnerCount = options.winners ?? 1;
 if ('prize' in options) data.prize = options.prize?.length ? options.prize : null;
 if ('role' in options) data.requiredRoles = options.role ? [options.role] : [];
 if ('time' in options) {
  const ms = parseDuration(options.time ?? '') ?? 0;
  if (ms <= 0) throw new Error(GiveawayErrors.invalidTime);
  data.endTime = new Date(Date.now() + ms);
 }

 set(data, 'collectSeconds', durationSeconds(options.claimTimeout, minCollectMs));

 return data as UpdateData<'giveaway'>;
};
