import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { SeparatorSpacingSize } from 'discord-api-types/v10';

import { textEmote } from '../../settings/Util/settingsEmotes.js';
import {
 accentColor,
 backRow,
 codeCommand,
 fit,
 type PanelView,
 paging,
 pageRow,
 type ViewContext,
} from '../Util/render.js';

const categoryLines = (ctx: ViewContext): string[] => {
 const byCategory = new Map<string, string[]>();

 ctx.data.settings.forEach((entry) => {
  const current = byCategory.get(entry.category) ?? [];
  current.push(`${ctx.mention(entry.fullName)} ${entry.description}`.trim());
  byCategory.set(entry.category, current);
 });

 return [...byCategory.entries()].flatMap(([category, entries]) => [`### ${category}`, ...entries]);
};

export default function (ctx: ViewContext): PanelView {
 const container = new ContainerBuilder().setAccentColor(accentColor());
 const header = [
  `## ${textEmote(ctx.emotes.settings)} ${ctx.t.scope.settings()}`,
  `> ${ctx.t.settings.intro({ settings: codeCommand('settings') })}`,
 ];
 if (!ctx.data.settings.length) header.push(ctx.t.settings.elsewhere());

 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header.join('\n')));

 const lines = categoryLines(ctx);
 const { chunks, current, pages } = paging(lines, ctx.page);

 if (lines.length) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    fit([`### ${ctx.t.base.t.Commands()}`, chunks[current - 1]].join('\n')),
   ),
  );
 }

 const buttons = pageRow(ctx, current, pages);
 if (buttons) container.addActionRowComponents(buttons);

 container.addActionRowComponents(backRow(ctx));

 return { container, pages };
}
