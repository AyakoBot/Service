import {
 ActionRowBuilder,
 ButtonBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import emotes from '../../../Classes/Emotes.js';
import type SettingsPlugin from '../Plugin.js';
import type {
 SettingsGuide,
 SettingsGuideSection,
 SettingsGuideStep,
 SettingsSchema,
} from '../SettingsSchema.js';

import type { TopLevelBuilder } from './buildGroupPage.js';
import { encodeSettingsId, SettingsAction } from './customId.js';
import { addFlag, hasFlag, removeFlag } from './guideFlags.js';
import { buttonEmoji, textEmote } from './settingsEmotes.js';

type SettingsTranslator = Awaited<ReturnType<SettingsPlugin['t']>>;

export interface BuildGuidePageArgs {
 settingName: string;
 schema: SettingsSchema;
 guide: SettingsGuide;
 rowId: string;
 row: Record<string, unknown>;
 originGroupId?: string;
 sectionId?: string;
 guideFlags: number;
 t: SettingsTranslator;
}

export const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);

export const stepVisible = (step: SettingsGuideStep, row: Record<string, unknown>): boolean =>
 !step.showIf || step.showIf(row).ok;

export const stepDone = (step: SettingsGuideStep, row: Record<string, unknown>): boolean =>
 row[step.column] !== false && !isUnset(row[step.column]);

export const sectionVisible = (
 section: SettingsGuideSection,
 row: Record<string, unknown>,
): boolean => !section.showIf || section.showIf(row).ok;

export const sectionOpen = (
 section: SettingsGuideSection,
 row: Record<string, unknown>,
 guideFlags: number,
): boolean =>
 !section.gate ||
 hasFlag(guideFlags, section.gate.flag) ||
 section.steps.some((step) => stepDone(step, row));

export const guideProgress = (
 sections: SettingsGuideSection[],
 row: Record<string, unknown>,
 guideFlags: number,
): { done: number; total: number } => {
 let done = 0;
 let total = 0;
 sections.forEach((section) => {
  if (!sectionVisible(section, row) || !sectionOpen(section, row, guideFlags)) return;
  section.steps.forEach((step) => {
   if (!step.required || !stepVisible(step, row)) return;
   total += 1;
   if (stepDone(step, row)) done += 1;
  });
 });
 return { done, total };
};

const headerToggleColumn = (schema: SettingsSchema): string | undefined =>
 schema.groups.flatMap((g) => g.fields).find((field) => field.headerToggle)?.column;

export const buildGuidePage = ({
 settingName,
 schema,
 guide,
 rowId,
 row,
 originGroupId,
 sectionId,
 guideFlags,
 t,
}: BuildGuidePageArgs): TopLevelBuilder[] => {
 const visible = guide.sections.filter((section) => sectionVisible(section, row));
 const index = Math.max(
  0,
  visible.findIndex((section) => section.id === sectionId),
 );
 const section = visible[index];

 const idFor = (
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

 const { done, total } = guideProgress(guide.sections, row, guideFlags);
 const intro = guide.intro ? `\n-# ${guide.intro}` : '';
 const page: TopLevelBuilder[] = [
  new TextDisplayBuilder().setContent(
   `# ${textEmote(guide.advert.emote ?? emotes.settings)} ${guide.title}\n-# ${t.guide.progress({
    done: String(done),
    total: String(total),
   })}${intro}`,
  ),
 ];

 if (!section) {
  page.push(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setLabel(t.guide.back())
     .setEmoji(buttonEmoji(emotes.back))
     .setCustomId(
      encodeSettingsId({
       action: SettingsAction.GroupNav,
       settingName,
       rowId,
       groupId: originGroupId ?? schema.groups[0]?.id,
       hideUnavail: true,
      }),
     ),
   ),
  );
  return page;
 }

 page.push(new SeparatorBuilder().setDivider(true));
 page.push(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(section.emote ?? emotes.settings)} ${section.label}${
    section.description ? `\n-# ${section.description}` : ''
   }`,
  ),
 );

 if (section.gate && !sectionOpen(section, row, guideFlags)) {
  const onFlags = addFlag(guideFlags, section.gate.flag);
  const offFlags = removeFlag(guideFlags, section.gate.flag);
  page.push(new TextDisplayBuilder().setContent(`-# ${section.gate.question}`));
  page.push(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Success)
     .setLabel(section.gate.yes ?? t.guide.yes())
     .setEmoji(buttonEmoji(emotes.tickWithBackground))
     .setCustomId(idFor(SettingsAction.Guide, undefined, onFlags)),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setLabel(section.gate.no ?? t.guide.no())
     .setEmoji(buttonEmoji(emotes.crossWithBackground))
     .setCustomId(idFor(SettingsAction.Guide, undefined, offFlags)),
   ),
  );
 } else {
  section.steps.forEach((step) => {
   if (!stepVisible(step, row)) return;
   const isDone = stepDone(step, row);
   const marker = textEmote(isDone ? emotes.tickWithBackground : emotes.crossWithBackground);
   const optional = step.required ? '' : `\n-# (${t.guide.optional()})`;
   const desc = step.description ? `\n-# ${step.description}` : '';
   page.push(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${marker} **${step.label}**${optional}${desc}`),
     )
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(isDone ? ButtonStyle.Secondary : ButtonStyle.Primary)
       .setLabel(isDone ? t.guide.review() : t.guide.set())
       .setEmoji(buttonEmoji(emotes.edit))
       .setCustomId(idFor(SettingsAction.GuideStep, step.column)),
     ),
   );
  });
 }

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
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.guide.back())
   .setEmoji(buttonEmoji(emotes.back))
   .setCustomId(
    encodeSettingsId({
     action: SettingsAction.GroupNav,
     settingName,
     rowId,
     groupId: originGroupId ?? schema.groups[0]?.id,
     hideUnavail: true,
    }),
   ),
 );

 const toggleColumn = headerToggleColumn(schema);
 if (toggleColumn) {
  nav.addComponents(
   new ButtonBuilder()
    .setStyle(row[toggleColumn] ? ButtonStyle.Success : ButtonStyle.Primary)
    .setLabel(t.guide.enable())
    .setEmoji(buttonEmoji(emotes.enabled))
    .setCustomId(idFor(SettingsAction.ToggleField, toggleColumn)),
  );
 }

 page.push(nav);
 return page;
};
