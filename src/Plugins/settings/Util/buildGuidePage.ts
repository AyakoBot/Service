import {
 ActionRowBuilder,
 ButtonBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import type SettingsPlugin from '../Plugin.js';
import type {
 SettingsGuide,
 SettingsGuideSection,
 SettingsGuideStep,
 SettingsSchema,
} from '../SettingsSchema.js';

import type { TopLevelBuilder } from './buildGroupPage.js';
import { encodeSettingsId, SettingsAction } from './customId.js';
import { addDecline, addFlag, hasDeclined, hasFlag } from './guideFlags.js';
import { isUnset } from './isUnset.js';
import { buttonEmoji, textEmote } from './settingsEmotes.js';

type SettingsTranslator = Awaited<ReturnType<SettingsPlugin['t']>>;

export type GuideActionState = Record<string, boolean>;

export interface BuildGuidePageArgs {
 settingName: string;
 schema: SettingsSchema;
 guide: SettingsGuide;
 rowId: string;
 row: Record<string, unknown>;
 originGroupId?: string;
 sectionId?: string;
 guideFlags: number;
 actionState?: GuideActionState;
 t: SettingsTranslator;
 emotes: EmoteSet;
}

export { isUnset } from './isUnset.js';

export const stepVisible = (step: SettingsGuideStep, row: Record<string, unknown>): boolean =>
 !step.showIf || step.showIf(row).ok;

export const stepRequired = (step: SettingsGuideStep, row: Record<string, unknown>): boolean =>
 (typeof step.required === 'function' ? step.required(row) : Boolean(step.required));

export const stepDone = (
 step: SettingsGuideStep,
 row: Record<string, unknown>,
 actionState: GuideActionState = {},
): boolean => {
 if (step.action) return Boolean(actionState[step.action.customId]);
 if (!step.column) return false;
 return row[step.column] !== false && !isUnset(row[step.column]);
};

export const sectionVisible = (
 section: SettingsGuideSection,
 row: Record<string, unknown>,
): boolean => !section.showIf || section.showIf(row).ok;

export const sectionDeclined = (section: SettingsGuideSection, guideFlags: number): boolean =>
 Boolean(section.gate && hasDeclined(guideFlags, section.gate.flag));

export const sectionOpen = (
 section: SettingsGuideSection,
 row: Record<string, unknown>,
 guideFlags: number,
 actionState: GuideActionState = {},
): boolean =>
 !section.gate ||
 hasFlag(guideFlags, section.gate.flag) ||
 section.steps.some((step) => stepDone(step, row, actionState));

const countableSections = (
 sections: SettingsGuideSection[],
 row: Record<string, unknown>,
 guideFlags: number,
 actionState: GuideActionState,
): SettingsGuideSection[] =>
 sections.filter(
  (section) =>
   sectionVisible(section, row) &&
   !sectionDeclined(section, guideFlags) &&
   sectionOpen(section, row, guideFlags, actionState),
 );

export const guideProgress = (
 sections: SettingsGuideSection[],
 row: Record<string, unknown>,
 guideFlags: number,
 actionState: GuideActionState = {},
): { done: number; total: number } => {
 let done = 0;
 let total = 0;
 countableSections(sections, row, guideFlags, actionState).forEach((section) => {
  section.steps.forEach((step) => {
   if (!stepRequired(step, row) || !stepVisible(step, row)) return;
   total += 1;
   if (stepDone(step, row, actionState)) done += 1;
  });
 });
 return { done, total };
};

export const requiredColumnStepsLeft = (
 sections: SettingsGuideSection[],
 row: Record<string, unknown>,
 guideFlags: number,
 actionState: GuideActionState = {},
 excludeColumn?: string,
): number => {
 let left = 0;
 countableSections(sections, row, guideFlags, actionState).forEach((section) => {
  section.steps.forEach((step) => {
   if (step.action || !step.column || step.column === excludeColumn) return;
   if (!stepRequired(step, row) || !stepVisible(step, row)) return;
   if (!stepDone(step, row, actionState)) left += 1;
  });
 });
 return left;
};

export const buildGuideBar = (
 emotes: EmoteSet,
 sections: SettingsGuideSection[],
 index: number,
): string => {
 if (sections.length < 2) return '';
 const icons = sections
  .map((section) => textEmote(section.emote ? emotes.get(section.emote) : emotes.settings))
  .join('');
 const pointer = `${sections
  .slice(0, index)
  .map(() => textEmote(emotes.invis))
  .join('')}${textEmote(emotes.up)}`;
 return `${icons}\n${pointer}`;
};

const headerToggleColumn = (schema: SettingsSchema): string | undefined =>
 schema.groups.flatMap((g) => g.fields).find((field) => field.headerToggle)?.column;

type IdFor = (
 action: SettingsAction,
 column?: string,
 flags?: number,
 guideSection?: string,
) => string;

const buildHeader = (
 emotes: EmoteSet,
 guide: SettingsGuide,
 visible: SettingsGuideSection[],
 index: number,
 progress: { done: number; total: number },
 complete: boolean,
 t: SettingsTranslator,
): TextDisplayBuilder => {
 const lines = [
  `# ${textEmote(
   guide.advert.emote ? emotes.get(guide.advert.emote) : emotes.settings,
  )} ${guide.title}`,
  `-# ${t.guide.progress({ done: String(progress.done), total: String(progress.total) })}`,
 ];
 if (complete) lines.push(`-# ${t.guide.complete()}`);
 else if (guide.intro) lines.push(`-# ${guide.intro}`);
 const bar = buildGuideBar(emotes, visible, index);
 if (bar) lines.push(bar);
 return new TextDisplayBuilder().setContent(lines.join('\n'));
};

const buildGateRow = (
 emotes: EmoteSet,
 section: SettingsGuideSection,
 visible: SettingsGuideSection[],
 index: number,
 guideFlags: number,
 idFor: IdFor,
 t: SettingsTranslator,
): ActionRowBuilder<ButtonBuilder> => {
 const gate = section.gate!;
 const nextId = visible[(index + 1) % visible.length]?.id;
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setLabel(gate.yes ?? t.guide.yes())
   .setEmoji(buttonEmoji(emotes.tickWithBackground))
   .setCustomId(idFor(SettingsAction.Guide, undefined, addFlag(guideFlags, gate.flag))),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setLabel(gate.no ?? t.guide.no())
   .setEmoji(buttonEmoji(emotes.crossWithBackground))
   .setCustomId(idFor(SettingsAction.Guide, undefined, addDecline(guideFlags, gate.flag), nextId)),
 );
};

const buildStepRow = (
 emotes: EmoteSet,
 step: SettingsGuideStep,
 row: Record<string, unknown>,
 rowId: string,
 actionState: GuideActionState,
 idFor: IdFor,
 t: SettingsTranslator,
): SectionBuilder => {
 const isDone = stepDone(step, row, actionState);
 const marker = textEmote(isDone ? emotes.tickWithBackground : emotes.crossWithBackground);
 const optional = stepRequired(step, row) ? '' : `\n-# (${t.guide.optional()})`;
 const desc = step.description ? `\n-# ${step.description}` : '';
 const button = new ButtonBuilder()
  .setStyle(isDone ? ButtonStyle.Secondary : ButtonStyle.Primary)
  .setLabel(isDone ? t.guide.review() : t.guide.set())
  .setEmoji(buttonEmoji(emotes.edit));

 if (step.action) button.setCustomId(`${step.action.customId}_${rowId}`);
 else button.setCustomId(idFor(SettingsAction.GuideStep, step.column));

 return new SectionBuilder()
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`${marker} **${step.label}**${optional}${desc}`),
  )
  .setButtonAccessory(button);
};

const buildBackButton = (
 emotes: EmoteSet,
 schema: SettingsSchema,
 settingName: string,
 rowId: string,
 originGroupId: string | undefined,
 complete: boolean,
 t: SettingsTranslator,
): ButtonBuilder =>
 new ButtonBuilder()
  .setStyle(complete ? ButtonStyle.Success : ButtonStyle.Secondary)
  .setLabel(complete ? t.guide.finish() : t.guide.back())
  .setEmoji(buttonEmoji(complete ? emotes.tickWithBackground : emotes.back))
  .setCustomId(
   encodeSettingsId({
    action: SettingsAction.GroupNav,
    settingName,
    rowId,
    groupId: originGroupId ?? schema.groups[0]?.id,
    hideUnavail: true,
   }),
  );

const buildNav = (
 args: BuildGuidePageArgs,
 visible: SettingsGuideSection[],
 index: number,
 complete: boolean,
 idFor: IdFor,
): ActionRowBuilder<ButtonBuilder> => {
 const { schema, guide, row, guideFlags, actionState, t, emotes } = args;
 const nav = new ActionRowBuilder<ButtonBuilder>();

 if (visible.length > 1) {
  const prev = visible[(index - 1 + visible.length) % visible.length];
  const next = visible[(index + 1) % visible.length];
  nav.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(buttonEmoji(emotes.prev))
    .setCustomId(idFor(SettingsAction.Guide, undefined, guideFlags, prev.id)),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(buttonEmoji(emotes.next))
    .setCustomId(idFor(SettingsAction.Guide, undefined, guideFlags, next.id)),
  );
 }

 nav.addComponents(
  buildBackButton(emotes, schema, args.settingName, args.rowId, args.originGroupId, complete, t),
 );

 const toggleColumn = headerToggleColumn(schema);
 if (toggleColumn) {
  const active = Boolean(row[toggleColumn]);
  const left = requiredColumnStepsLeft(guide.sections, row, guideFlags, actionState, toggleColumn);
  nav.addComponents(
   new ButtonBuilder()
    .setStyle(active ? ButtonStyle.Success : ButtonStyle.Primary)
    .setLabel(active ? t.guide.enabled() : t.guide.enable())
    .setEmoji(buttonEmoji(active ? emotes.enabled : emotes.disabled))
    .setDisabled(!active && left > 0)
    .setCustomId(idFor(SettingsAction.ToggleField, toggleColumn)),
  );
 }

 return nav;
};

export const buildGuidePage = (args: BuildGuidePageArgs): TopLevelBuilder[] => {
 const { settingName, schema, guide, rowId, row, originGroupId, sectionId, guideFlags, t, emotes } =
  args;
 const actionState = args.actionState ?? {};

 const visible = guide.sections.filter(
  (section) => sectionVisible(section, row) && !sectionDeclined(section, guideFlags),
 );
 const index = Math.max(
  0,
  visible.findIndex((section) => section.id === sectionId),
 );
 const section = visible[index];

 const idFor: IdFor = (
  action: SettingsAction,
  column?: string,
  flags = guideFlags,
  guideSection = section?.id,
 ): string =>
  encodeSettingsId({
   action,
   settingName,
   rowId,
   groupId: originGroupId,
   column,
   hideUnavail: true,
   guideFlags: flags,
   guideSection,
  });

 const progress = guideProgress(guide.sections, row, guideFlags, actionState);
 const complete = progress.total > 0 && progress.done === progress.total;
 const page: TopLevelBuilder[] = [
  buildHeader(emotes, guide, visible, index, progress, complete, t),
 ];

 if (!section) {
  page.push(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    buildBackButton(emotes, schema, settingName, rowId, originGroupId, complete, t),
   ),
  );
  return page;
 }

 page.push(new SeparatorBuilder().setDivider(true));
 page.push(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(section.emote ? emotes.get(section.emote) : emotes.settings)} ${section.label}${
    section.description ? `\n-# ${section.description}` : ''
   }`,
  ),
 );

 if (section.gate && !sectionOpen(section, row, guideFlags, actionState)) {
  page.push(new TextDisplayBuilder().setContent(`-# ${section.gate.question}`));
  page.push(buildGateRow(emotes, section, visible, index, guideFlags, idFor, t));
 } else {
  section.steps.forEach((step) => {
   if (!stepVisible(step, row)) return;
   page.push(buildStepRow(emotes, step, row, rowId, actionState, idFor, t));
  });
 }

 page.push(buildNav(args, visible, index, complete, idFor));
 return page;
};
