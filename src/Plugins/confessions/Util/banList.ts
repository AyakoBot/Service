import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import type { ConfessionBan } from '@ayako/database';
import {
 ButtonStyle,
 SeparatorSpacingSize,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { Colors } from '../../../Types/index.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import { ConfessionsRoute } from '../Classes/Routes.js';

import type { ConfessionsTranslator } from './container.js';
import { clip } from './reportCard.js';

type RouteFn = (name: string, ...args: string[]) => string;

export const bansPerPage = 5;

const entryBudget = 640;
const reasonBudget = 150;

export interface BanPage {
 bans: ConfessionBan[];
 page: number;
 pages: number;
 total: number;
}

const subjectOf = (t: ConfessionsTranslator, ban: ConfessionBan): string => {
 if (ban.reply) {
  return ban.number === null
   ? t.log.replyPlain()
   : t.log.replySubject({ number: String(ban.number) });
 }

 return ban.number === null
  ? t.bans.unposted()
  : t.log.confessionSubject({ number: String(ban.number) });
};

export const banEntryText = (t: ConfessionsTranslator, ban: ConfessionBan): string => {
 const term = ban.until
  ? t.log.until({ time: constants.formatters.getTime(ban.until.getTime()) })
  : t.log.permanent();
 const reason = ban.reason ? `${t.base.t.Reason()}: ${clip(ban.reason, reasonBudget)}` : null;
 const lines = [
  `**${t.bans.bannedAt({ time: constants.formatters.getTime(ban.createdAt.getTime()) })}** · ${t.log.by({ user: `<@${ban.by}>` })}`,
  subjectOf(t, ban),
  `-# ${[term, reason].filter(Boolean).join(' · ')}`,
 ];
 const used = lines.join('\n').length;
 if (!ban.content) return [...lines, `-# ${t.bans.noText()}`].join('\n');

 return [...lines, clip(ban.content, Math.max(0, entryBudget - used)).replace(/^/gm, '> ')].join('\n');
};

const entrySection = (
 t: ConfessionsTranslator,
 ban: ConfessionBan,
 page: number,
 route: RouteFn,
): SectionBuilder =>
 new SectionBuilder()
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(banEntryText(t, ban)))
  .setButtonAccessory(
   new ButtonBuilder()
    .setCustomId(route(ConfessionsRoute.BansUnban, ban.identity, String(page)))
    .setStyle(ButtonStyle.Secondary)
    .setLabel(t.review.unban()),
  );

const pageRow = (
 t: ConfessionsTranslator,
 view: BanPage,
 route: RouteFn,
 emotes: EmoteSet,
): ActionRowBuilder<ButtonBuilder> =>
 new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.BansPage, String(view.page - 1)))
   .setStyle(ButtonStyle.Secondary)
   .setEmoji(buttonEmoji(emotes.get(EmoteName.Prev)))
   .setDisabled(view.page <= 0),
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.BansPage, String(view.page)))
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.bans.page({ page: String(view.page + 1), pages: String(view.pages) }))
   .setDisabled(true),
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.BansPage, String(view.page + 1)))
   .setStyle(ButtonStyle.Secondary)
   .setEmoji(buttonEmoji(emotes.get(EmoteName.Next)))
   .setDisabled(view.page >= view.pages - 1),
 );

export const banListPage = (
 t: ConfessionsTranslator,
 view: BanPage,
 route: RouteFn,
 emotes: EmoteSet,
): APIMessageTopLevelComponent[] => {
 const container = new ContainerBuilder()
  .setAccentColor(Colors.Danger)
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `### ${t.bans.title()}\n-# ${view.total ? t.bans.count({ count: String(view.total) }) : t.bans.empty()}`,
   ),
  );

 view.bans.forEach((ban) => {
  container
   .addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
   )
   .addSectionComponents(entrySection(t, ban, view.page, route));
 });

 const components: APIMessageTopLevelComponent[] = [
  container.toJSON() as APIMessageTopLevelComponent,
 ];
 if (view.pages > 1) {
  components.push(pageRow(t, view, route, emotes).toJSON() as APIMessageTopLevelComponent);
 }

 return components;
};
