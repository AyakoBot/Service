import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, SeparatorSpacingSize } from 'discord-api-types/v10';

import { textEmote } from '../../settings/Util/settingsEmotes.js';
import { HelpRoute } from '../Classes/Routes.js';
import {
 accentColor,
 codeCommand,
 fit,
 type PanelView,
 paging,
 pageRow,
 scopeRow,
 selectRow,
 type ViewContext,
} from '../Util/render.js';

const listLines = (ctx: ViewContext): string[] =>
 ctx.data.surface.topLevel.map((entry) => `${ctx.mention(entry.name)} ${entry.description}`.trim());

const picker = (ctx: ViewContext) => {
 const entries = ctx.data.surface.topLevel.map((entry) => ({
  label: entry.name,
  description: entry.description,
  value: entry.fullName,
 }));

 if (!entries.length) return null;

 return selectRow(
  ctx.plugin.getRoute(HelpRoute.Select, ctx.sessionId),
  ctx.t.panel.pick(),
  entries,
 );
};

const postRow = (ctx: ViewContext): ActionRowBuilder<ButtonBuilder> =>
 new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(ctx.plugin.getRoute(HelpRoute.Post, ctx.sessionId))
   .setLabel(ctx.t.panel.post()),
 );

export default function (ctx: ViewContext): PanelView {
 const container = new ContainerBuilder().setAccentColor(accentColor());
 const header = [
  `## ${textEmote(ctx.emotes.command)} ${ctx.t.panel.title({ bot: ctx.data.botName })}`,
 ];

 if (ctx.data.degraded) header.push(ctx.t.panel.botMissing());

 header.push(ctx.t.panel.intro({ search: codeCommand('help command') }));
 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header.join('\n')));

 const lines = listLines(ctx);
 const { chunks, current, pages } = paging(lines, ctx.page);

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   fit([`### ${ctx.t.base.t.Commands()}`, chunks[current - 1] ?? ctx.t.panel.empty()].join('\n')),
  ),
 );

 const pickerRow = picker(ctx);
 if (pickerRow) container.addActionRowComponents(pickerRow);

 const scopeSelector = scopeRow(ctx);
 if (scopeSelector) container.addActionRowComponents(scopeSelector);

 const buttons = pageRow(ctx, current, pages);
 if (buttons) container.addActionRowComponents(buttons);

 container.addActionRowComponents(postRow(ctx));

 return { container, pages };
}
