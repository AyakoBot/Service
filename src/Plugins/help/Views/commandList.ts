import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { SeparatorSpacingSize } from 'discord-api-types/v10';

import { textEmote } from '../../settings/Util/settingsEmotes.js';
import { HelpScope } from '../Classes/HelpTypes.js';
import {
 accentColor,
 backRow,
 fit,
 type PanelView,
 paging,
 pageRow,
 scopeRow,
 type ViewContext,
} from '../Util/render.js';

const leafLines = (ctx: ViewContext): string[] => {
 if (ctx.scope === HelpScope.Settings) {
  return ctx.data.settings.map((entry) =>
   `${ctx.mention(entry.fullName)} ${entry.description}`.trim(),
  );
 }

 return ctx.data.surface.leaves.map((leaf) => ctx.mention(leaf));
};

const contextLines = (ctx: ViewContext): string[] =>
 ctx.data.surface.contextMenus.map((entry) => `\`${entry.name}\``);

export default function (ctx: ViewContext): PanelView {
 const container = new ContainerBuilder().setAccentColor(accentColor());
 const title = ctx.scope === HelpScope.Settings ? ctx.t.scope.settings() : ctx.t.base.t.Commands();

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(ctx.emotes.command)} ${ctx.t.panel.title({ bot: ctx.data.botName })}\n### ${title}`,
  ),
 );

 const lines = leafLines(ctx);
 const { chunks, current, pages } = paging(lines, ctx.page);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(fit(chunks[current - 1] ?? ctx.t.panel.empty())),
 );

 const context = contextLines(ctx);
 if (context.length) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    fit([`### ${ctx.t.scope.context()}`, ...context].join('\n')),
   ),
  );
 }

 const scopeSelector = scopeRow(ctx);
 if (scopeSelector) container.addActionRowComponents(scopeSelector);

 const buttons = pageRow(ctx, current, pages);
 if (buttons) container.addActionRowComponents(buttons);

 container.addActionRowComponents(backRow(ctx));

 return { container, pages };
}
