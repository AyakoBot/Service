import type { GiveawaySetting } from '@ayako/database';

import { maxWinners } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

export interface GiveawayDefaults {
 winnerCount: number;
 durationSeconds: number | null;
 collectSeconds: number | null;
 accentColor: string | null;
 logChannel: string | null;
 dmWinners: boolean;
 trackActivity: boolean;
 botToken: string | null;
}

const positive = (value: unknown) => {
 const seconds = Number(value ?? 0);
 return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

export const fromRow = (row: GiveawaySetting | null): GiveawayDefaults => ({
 winnerCount: Math.min(maxWinners, Math.max(1, Math.round(Number(row?.winnerCount ?? 1)) || 1)),
 durationSeconds: positive(row?.duration),
 collectSeconds: positive(row?.collectSeconds),
 accentColor: row?.accentColor ?? null,
 logChannel: row?.logChannel ?? null,
 dmWinners: row?.dmWinners ?? true,
 trackActivity: row?.trackActivity ?? false,
 botToken: row?.botToken ?? null,
});

export const giveawayDefaults = async function (
 this: GiveawaysPlugin,
 guildId: string,
): Promise<GiveawayDefaults> {
 const row = await this.client.db.client.giveawaySetting.findFirst({ where: { guild: guildId } });

 return fromRow(row);
};
