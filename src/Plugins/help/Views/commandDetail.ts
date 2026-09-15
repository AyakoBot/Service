import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { SeparatorSpacingSize } from 'discord-api-types/v10';

import { textEmote } from '../../settings/Util/settingsEmotes.js';
import type { HelpCommandView } from '../Classes/HelpTypes.js';
import {
 accentColor,
 backRow,
 fit,
 optionLine,
 type PanelView,
 paging,
 pageRow,
 type ViewContext,
} from '../Util/render.js';

const usages = (ctx: ViewContext, target: HelpCommandView): string[] =>
 target.leaves.map((leaf) => ctx.mention(leaf));

const optionSections = (ctx: ViewContext, target: HelpCommandView): string[] => {
 const lines: string[] = [];

 target.leaves.forEach((leaf) => {
  const entry = ctx.data.surface.byPath.get(leaf);
  if (!entry?.options.length) return;

  if (target.leaves.length > 1) {
   lines.push(`### ${ctx.t.scope.optionsFor({ command: ctx.mention(leaf) })}`);
  }

  entry.options.forEach((option) => lines.push(optionLine(ctx.t, option)));
 });

 return lines.length ? lines : [ctx.t.options.noOptions()];
};

export default function (ctx: ViewContext, mismatch: string | null = null): PanelView {
 const target = ctx.target;
 const container = new ContainerBuilder().setAccentColor(accentColor());

 if (!target) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(fit(mismatch ? `> ${mismatch}` : ctx.t.panel.empty())),
  );
  container.addActionRowComponents(backRow(ctx));

  return { container, pages: 1 };
 }

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(ctx.emotes.command)} ${ctx.mention(target.fullName)}`,
    target.description ? `> ${target.description}` : '',
   ]
    .filter(Boolean)
    .join('\n'),
  ),
 );

 if (mismatch) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fit(`> ${mismatch}`)));
 }

 if (target.leaves.length > 1) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    fit([`### ${ctx.t.scope.tree()}`, ...usages(ctx, target)].join('\n')),
   ),
  );
 }

 const { chunks, current, pages } = paging(optionSections(ctx, target), ctx.page);

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(fit(chunks[current - 1] ?? ctx.t.options.noOptions())),
 );

 const buttons = pageRow(ctx, current, pages);
 if (buttons) container.addActionRowComponents(buttons);

 container.addActionRowComponents(backRow(ctx));

 return { container, pages };
}
