import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ConfessionAnonymity } from '@ayako/database';
import {
 ButtonStyle,
 ComponentType,
 MessageFlags,
 type APIEmbed,
 type APIMessageComponentEmoji,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import interpolate from '../../../Util/interpolate.js';
import type { SavedContent } from '../../../Util/savedRef.js';
import type { TranslatorType } from '../../../Util/translator.js';
import { ConfessionsRoute } from '../Classes/Routes.js';
import en from '../Language/en-GB.json' with { type: 'json' };

type RouteFn = (name: string, ...args: string[]) => string;

export type ConfessionsTranslator = TranslatorType<typeof en> & { base: BaseLang };

export interface ConfessionView {
 number: number | null;
 numbered: boolean;
 content: string;
 media: string | null;
 anonymity: ConfessionAnonymity;
}

export interface ReviewView extends ConfessionView {
 confessionId: string;
 parentNumber?: number | null;
 screened: string | null;
}

export const confessionTitle = (t: ConfessionsTranslator, view: ConfessionView): string =>
 view.numbered && view.number !== null
  ? t.confession.heading({ number: String(view.number) })
  : t.confession.headingPlain();

export const anonymityNote = (t: ConfessionsTranslator, anonymity: ConfessionAnonymity): string =>
 anonymity === ConfessionAnonymity.Anonymous
  ? t.confession.anonymousNote()
  : t.confession.hiddenNote();

const textLimit = 4000;
const reviewReserve = 200;

const quoted = (text: string): string => text.replace(/^/gm, '> ');

const screenedNote = (t: ConfessionsTranslator, view: ReviewView): string | null => {
 if (!view.screened) return null;

 const note = `-# ${t.review.screened()}`;
 const preview = `${note}
${quoted(view.screened)}`;

 return view.content.length + preview.length + reviewReserve <= textLimit ? preview : note;
};

const reviewHeading = (t: ConfessionsTranslator, view: ReviewView): string => {
 if (view.parentNumber === undefined) return t.review.heading();

 return view.parentNumber === null
  ? t.review.replyHeadingPlain()
  : t.review.replyHeading({ number: String(view.parentNumber) });
};

const withMedia = (container: ContainerBuilder, media: string | null): ContainerBuilder => {
 if (!media) return container;

 return container.addMediaGalleryComponents(
  new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(media)),
 );
};

export const randomAccent = (): number => Math.floor(Math.random() * 0x1000000);

export const menuButton = (
 route: RouteFn,
 confessionId: string,
 emoji: APIMessageComponentEmoji,
): ButtonBuilder =>
 new ButtonBuilder()
  .setCustomId(route(ConfessionsRoute.Menu, confessionId))
  .setStyle(ButtonStyle.Secondary)
  .setEmoji(emoji);

export const submitButton = (t: ConfessionsTranslator, route: RouteFn): ButtonBuilder =>
 new ButtonBuilder()
  .setCustomId(route(ConfessionsRoute.Submit))
  .setStyle(ButtonStyle.Secondary)
  .setLabel(t.confession.submitButton());

const headed = (
 container: ContainerBuilder,
 heading: string,
 menu: ButtonBuilder | null,
): ContainerBuilder => {
 const text = new TextDisplayBuilder().setContent(heading);
 if (!menu) return container.addTextDisplayComponents(text);

 return container.addSectionComponents(
  new SectionBuilder().addTextDisplayComponents(text).setButtonAccessory(menu),
 );
};

export const replyButton = (
 t: ConfessionsTranslator,
 route: RouteFn,
 confessionId: string,
): ButtonBuilder =>
 new ButtonBuilder()
  .setCustomId(route(ConfessionsRoute.Reply, confessionId))
  .setStyle(ButtonStyle.Secondary)
  .setLabel(t.confession.replyButton());

export const buildReply = (
 t: ConfessionsTranslator,
 view: ConfessionView,
 menu: ButtonBuilder,
): APIMessageTopLevelComponent[] => {
 const container = headed(
  new ContainerBuilder().setAccentColor(randomAccent()),
  `### ${t.confession.replyHeading()}`,
  menu,
 ).addTextDisplayComponents(new TextDisplayBuilder().setContent(view.content));

 withMedia(container, view.media);

 return [container.toJSON() as APIMessageTopLevelComponent];
};

export const buildConfession = (
 t: ConfessionsTranslator,
 view: ConfessionView,
 menu: ButtonBuilder | null,
): APIMessageTopLevelComponent[] => {
 const container = headed(
  new ContainerBuilder().setAccentColor(randomAccent()),
  `## ${confessionTitle(t, view)}`,
  menu,
 ).addTextDisplayComponents(new TextDisplayBuilder().setContent(view.content));

 withMedia(container, view.media);

 return [container.toJSON() as APIMessageTopLevelComponent];
};

const reviewButtons = (
 t: ConfessionsTranslator,
 view: ReviewView,
 route: RouteFn,
): ActionRowBuilder<ButtonBuilder> => {
 const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.Approve, view.confessionId))
   .setStyle(ButtonStyle.Success)
   .setLabel(t.review.approve()),
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.Deny, view.confessionId))
   .setStyle(ButtonStyle.Danger)
   .setLabel(t.review.deny()),
  new ButtonBuilder()
   .setCustomId(route(ConfessionsRoute.Ban, view.confessionId))
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.review.ban()),
 );

 if (view.anonymity === ConfessionAnonymity.Unmaskable) {
  row.addComponents(
   new ButtonBuilder()
    .setCustomId(route(ConfessionsRoute.Reveal, view.confessionId))
    .setStyle(ButtonStyle.Secondary)
    .setLabel(t.review.reveal()),
  );
 }

 return row;
};

export const buildReview = (
 t: ConfessionsTranslator,
 view: ReviewView,
 route: RouteFn,
): APIMessageTopLevelComponent[] => {
 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`## ${reviewHeading(t, view)}\n${view.content}`),
 );

 withMedia(container, view.media);

 const screened = screenedNote(t, view);
 if (screened) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(screened));

 container
  .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
  .addActionRowComponents(reviewButtons(t, view, route));

 return [container.toJSON() as APIMessageTopLevelComponent];
};

export const buildResolved = (
 t: ConfessionsTranslator,
 view: ReviewView,
 verdict: string,
 unban: boolean,
 route: RouteFn,
): APIMessageTopLevelComponent[] => {
 const container = new ContainerBuilder()
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`## ${reviewHeading(t, view)}\n${view.content}`),
  )
  .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${verdict}`));

 if (unban) {
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setCustomId(route(ConfessionsRoute.Unban, view.confessionId))
     .setStyle(ButtonStyle.Secondary)
     .setLabel(t.review.unban()),
   ),
  );
 }

 return [container.toJSON() as APIMessageTopLevelComponent];
};

export interface PostContent {
 flags: MessageFlags | 0;
 components: APIMessageTopLevelComponent[];
 embeds: APIEmbed[];
}

export interface PostControls {
 menu: ButtonBuilder;
 buttons: ButtonBuilder[];
}

const rowOf = (buttons: ButtonBuilder[]): APIMessageTopLevelComponent[] =>
 buttons.length
  ? [
     new ActionRowBuilder<ButtonBuilder>()
      .addComponents(...buttons)
      .toJSON() as APIMessageTopLevelComponent,
    ]
  : [];

const withGallery = (
 components: APIMessageTopLevelComponent[],
 media: string | null,
): APIMessageTopLevelComponent[] =>
 media
  ? [...components, { type: ComponentType.MediaGallery, items: [{ media: { url: media } }] }]
  : components;

const withImage = (embed: APIEmbed, media: string | null): APIEmbed =>
 media && !embed.image ? { ...embed, image: { url: media } } : embed;

export const buildPost = (
 t: ConfessionsTranslator,
 view: ConfessionView,
 saved: SavedContent | null,
 vars: Record<string, string>,
 controls: PostControls,
): PostContent => {
 if (saved?.components) {
  return {
   flags: MessageFlags.IsComponentsV2,
   components: [
    ...withGallery(interpolate(saved.components, vars), view.media),
    ...rowOf([controls.menu, ...controls.buttons]),
   ],
   embeds: [],
  };
 }

 if (saved?.embed) {
  return {
   flags: 0,
   components: rowOf([controls.menu, ...controls.buttons]),
   embeds: [withImage(interpolate(saved.embed, vars), view.media)],
  };
 }

 return {
  flags: MessageFlags.IsComponentsV2,
  components: [...buildConfession(t, view, controls.menu), ...rowOf(controls.buttons)],
  embeds: [],
 };
};
