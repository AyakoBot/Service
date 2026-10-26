import type { GiveawayBonusSnapshot } from '@ayako/database';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { maxBonusEntries } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

import capped from './capped.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export const entriesFor = (roles: string[], snapshot: GiveawayBonusSnapshot[]) => {
 const extra = snapshot
  .filter((row) => roles.includes(row.role))
  .reduce((total, row) => total + Math.floor(Number(row.extra)), 0);

 return Math.min(Math.max(1 + extra, 1), maxBonusEntries);
};

export const bonusLine = (t: Translator, emotes: EmoteSet, snapshot: GiveawayBonusSnapshot[]) => {
 if (!snapshot.length) return null;

 const roles = capped(
  t,
  [...snapshot]
   .sort((a, b) => Number(b.extra) - Number(a.extra))
   .map((row) => t.bonus.entry({ role: `<@&${row.role}>`, count: String(Number(row.extra)) })),
 );

 return `${constants.formatters.getEmote(emotes.plus)} ${t.bonus.line({ roles })}`;
};

export const bonusSnapshot = async function (this: GiveawaysPlugin, messageId: string) {
 return this.client.db.client.giveawayBonusSnapshot.findMany({ where: { message: messageId } });
};

export const snapshotBonusRoles = async function (
 this: GiveawaysPlugin,
 message: string,
 roles: string[],
 extra: number,
) {
 if (!roles.length) return;

 await this.client.db.client.giveawayBonusSnapshot.createMany({
  data: roles.map((role) => ({ message, role, extra })),
  skipDuplicates: true,
 });
};
