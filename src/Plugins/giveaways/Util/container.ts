import type { Giveaway, GiveawayBonusSnapshot } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from '@discordjs/core';
import type { APIMessageTopLevelComponent } from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import { GiveawaysRoute } from '../Classes/Routes.js';
import { listPageSize } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

import { bonusLine } from './bonusEntries.js';
import capped from './capped.js';
import { requirementLines } from './requirements.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export interface GiveawayExtras {
 snapshot: GiveawayBonusSnapshot[];
 accentColor: number | null;
}

export { listPageSize };

export const giveawayLink = (giveaway: Giveaway) =>
 `https://discord.com/channels/${giveaway.guild}/${giveaway.channel}/${giveaway.message}`;

export const hasReward = (giveaway: Giveaway) =>
 !!giveaway.prize || Number(giveaway.currency ?? 0) > 0 || giveaway.winnerRoles.length > 0;

export const hasClaimFlow = (giveaway: Giveaway) =>
 hasReward(giveaway) && !!Number(giveaway.collectSeconds);

export const pingedWinners = (giveaway: Giveaway) =>
 giveaway.unclaimedWinners.length ? giveaway.unclaimedWinners : giveaway.winners;

export const entryCount = (giveaway: Giveaway) => new Set(giveaway.participants).size;

const rel = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`;
const full = (date: Date) =>
 `<t:${Math.floor(date.getTime() / 1000)}:F> (<t:${Math.floor(date.getTime() / 1000)}:R>)`;

export { rel, full };

const winnersLine = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) => {
 const { getEmote } = constants.formatters;
 if (!giveaway.ended || giveaway.cancelled) {
  return `${getEmote(emotes.crown)} ${t.giveaway.possibleWinners({
   count: String(Number(giveaway.winnerCount)),
  })}`;
 }
 if (!giveaway.winners.length) return `${getEmote(emotes.crown)} ${t.giveaway.noEntries()}`;
 return `${getEmote(emotes.crown)} ${t.giveaway.winners({
  winners: capped(
   t,
   giveaway.winners.map((w) => `<@${w}>`),
  ),
 })}`;
};

const rewardLine = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) => {
 const currency = Number(giveaway.currency ?? 0);
 const parts = [
  ...(currency > 0 ? [t.giveaway.currency({ amount: String(currency) })] : []),
  ...giveaway.winnerRoles.map((role) => `<@&${role}>`),
 ];
 if (!parts.length) return null;

 return `${constants.formatters.getEmote(emotes.gift)} ${t.giveaway.rewards({
  rewards: parts.join(', '),
 })}`;
};

const claimButton = function (this: GiveawaysPlugin, t: Translator, giveaway: Giveaway) {
 if (!giveaway.ended || giveaway.cancelled || !hasReward(giveaway)) return null;
 if (!giveaway.winners.length) return null;

 if (!giveaway.claimingDone) {
  return new ButtonBuilder()
   .setStyle(ButtonStyle.Primary)
   .setCustomId(this.getRoute(GiveawaysRoute.Claim))
   .setLabel(t.claim.button());
 }

 return new ButtonBuilder()
  .setStyle(ButtonStyle.Secondary)
  .setCustomId(this.getRoute(GiveawaysRoute.Claim))
  .setLabel(giveaway.unclaimedWinners.length ? t.claim.expired() : t.claim.allClaimed())
  .setDisabled(true);
};

export const giveawayButtons = function (
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
) {
 const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(GiveawaysRoute.Participate))
   .setEmoji(buttonEmoji(emotes.gift))
   .setLabel(t.giveaway.participate())
   .setDisabled(giveaway.ended),
 );

 const claim = claimButton.call(this, t, giveaway);
 if (claim) buttons.addComponents(claim);

 return buttons;
};

const infoBlock = (t: Translator, emotes: EmoteSet, giveaway: Giveaway, extras: GiveawayExtras) => {
 const { getEmote } = constants.formatters;

 return [
  `${getEmote(emotes.member)} ${t.giveaway.entries({ count: String(entryCount(giveaway)) })}`,
  winnersLine(t, emotes, giveaway),
  `${getEmote(emotes.timer)} ${
   giveaway.ended
    ? t.giveaway.endedAt({ time: rel(giveaway.endTime) })
    : t.giveaway.endsAt({ time: full(giveaway.endTime) })
  }`,
  ...requirementLines(t, emotes, giveaway),
  ...[bonusLine(t, emotes, extras.snapshot), rewardLine(t, emotes, giveaway)].filter(
   (line): line is string => !!line,
  ),
  `${getEmote(emotes.author)} ${t.giveaway.host({ user: `<@${giveaway.host}>` })}`,
 ].join('\n');
};

const heading = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) => {
 const state = giveaway.cancelled
  ? ` - ${t.giveaway.cancelled()}`
  : giveaway.ended
    ? ` - ${t.giveaway.ended()}`
    : '';

 return `### ${constants.formatters.getEmote(emotes.gift)} ${t.giveaway.title()}${state}`;
};

export default function buildGiveaway(
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
 extras: GiveawayExtras,
): APIMessageTopLevelComponent[] {
 const container = new ContainerBuilder();
 if (extras.accentColor !== null) container.setAccentColor(extras.accentColor);

 const title = new TextDisplayBuilder().setContent(heading(t, emotes, giveaway));
 const body = new TextDisplayBuilder().setContent(giveaway.description);

 if (giveaway.thumbnail) {
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(title, body)
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(giveaway.thumbnail)),
  );
 } else {
  container.addTextDisplayComponents(title, body);
 }

 if (giveaway.banner) {
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(giveaway.banner)),
  );
 }

 container
  .addSeparatorComponents(new SeparatorBuilder())
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(infoBlock(t, emotes, giveaway, extras)),
  )
  .addActionRowComponents(giveawayButtons.call(this, t, emotes, giveaway));

 return [container.toJSON()];
}

export const buildAnnouncement = function (
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
): APIMessageTopLevelComponent[] {
 const { getEmote } = constants.formatters;
 const pinged = pingedWinners(giveaway);
 const claiming = hasClaimFlow(giveaway) && !!giveaway.claimUntil;

 return [
  new TextDisplayBuilder()
   .setContent(t.end.won({ winners: pinged.map((w) => `<@${w}>`).join(' ') }))
   .toJSON(),
  new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${getEmote(emotes.crown)} ${t.end.title()}`),
    new TextDisplayBuilder().setContent(
     claiming
      ? `${t.end.clickButton()}\n${t.end.until({ time: rel(giveaway.claimUntil as Date) })}`
      : hasReward(giveaway)
        ? t.end.clickButton()
        : t.end.dmHost({ host: `<@${giveaway.host}>` }),
    ),
   )
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(t.end.link())
      .setURL(giveawayLink(giveaway)),
     new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId(this.getRoute(GiveawaysRoute.Reroll, giveaway.message))
      .setEmoji(buttonEmoji(emotes.refresh))
      .setLabel(t.end.reroll()),
    ),
   )
   .toJSON(),
 ];
};

export const paginate = <T>(rows: T[], page: number) => {
 const pages = Math.max(1, Math.ceil(rows.length / listPageSize));
 const current = Math.min(Math.max(page, 0), pages - 1);

 return { pages, current, slice: rows.slice(current * listPageSize, (current + 1) * listPageSize) };
};

export const pageButtons = function (
 this: GiveawaysPlugin,
 emotes: EmoteSet,
 route: GiveawaysRoute,
 current: number,
 pages: number,
) {
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(route, String(current - 1)))
   .setEmoji(buttonEmoji(emotes.back))
   .setDisabled(current === 0),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(route, String(current + 1)))
   .setEmoji(buttonEmoji(emotes.forth))
   .setDisabled(current >= pages - 1),
 );
};

export const buildList = function (
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 rows: Giveaway[],
 page: number,
): APIMessageTopLevelComponent[] {
 const { getEmote } = constants.formatters;
 const { pages, current, slice } = paginate(rows, page);

 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `### ${getEmote(emotes.gift)} ${t.list.title()}\n${t.list.page({
    page: String(current + 1),
    pages: String(pages),
   })}`,
  ),
 );

 if (!slice.length) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t.list.none()));
 }

 slice.forEach((giveaway) => {
  const state = giveaway.cancelled
   ? t.giveaway.cancelled()
   : giveaway.ended
     ? t.giveaway.ended()
     : t.giveaway.endsAt({ time: rel(giveaway.endTime) });

  container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    [
     `**[${giveaway.description.slice(0, 80)}](${giveawayLink(giveaway)})**`,
     `${state} · ${t.giveaway.entries({
      count: String(entryCount(giveaway)),
     })} · ${t.giveaway.host({ user: `<@${giveaway.host}>` })}`,
    ].join('\n'),
   ),
  );
 });

 if (pages > 1) {
  container.addActionRowComponents(
   pageButtons.call(this, emotes, GiveawaysRoute.List, current, pages),
  );
 }

 return [container.toJSON()];
};
