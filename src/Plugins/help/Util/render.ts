import {
 ActionRowBuilder,
 ButtonBuilder,
 type ContainerBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import { ButtonStyle, MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../Types/index.js';
import type { CommandMention } from '../../../Util/commandMention.js';
import { chunkByLength, containerCharBudget } from '../../../Util/fmt.js';
import { RespondMode } from '../../../Util/respondMode.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import {
 HelpScope,
 type HelpCommandView,
 type HelpOptionView,
 type HelpPanelData,
} from '../Classes/HelpTypes.js';
import { HelpRoute } from '../Classes/Routes.js';
import type HelpPlugin from '../Plugin.js';

export type Translator = Awaited<ReturnType<HelpPlugin['t']>>;

export interface ViewContext {
 data: HelpPanelData;
 emotes: EmoteSet;
 mention: CommandMention;
 page: number;
 plugin: HelpPlugin;
 scope: HelpScope;
 sessionId: string;
 t: Translator;
 target: HelpCommandView | null;
}

export interface PanelView {
 container: ContainerBuilder;
 pages: number;
}

const selectLimit = 25;
const labelLimit = 100;
const descriptionLimit = 100;
const trim = (text: string, limit: number): string =>
 text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

export const accentColor = (): number => Colors.Info;

export const codeCommand = (name: string): string => `\`/${name}\``;

export const fit = (content: string): string =>
 content.length > containerCharBudget ? `${content.slice(0, containerCharBudget - 1)}…` : content;

export const optionLine = (t: Translator, option: HelpOptionView): string => {
 const marker = option.required ? t.options.required() : t.options.optional();
 const choices = option.choices
  ? ` ${t.options.choices({ choices: option.choices.join(', ') })}`
  : '';

 return `> \`${option.name}\` (${t.base.t[option.kind]()}, ${marker})${choices}`;
};

export const paging = (
 lines: string[],
 page: number,
): { chunks: string[]; current: number; pages: number } => {
 const chunks = chunkByLength(lines);
 const pages = chunks.length;
 const current = Math.min(Math.max(page, 1), pages);

 return { chunks, current, pages };
};

export const selectRow = (
 customId: string,
 placeholder: string,
 entries: { label: string; description?: string; value: string; isDefault?: boolean }[],
): ActionRowBuilder<StringSelectMenuBuilder> =>
 new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
   .setCustomId(customId)
   .setPlaceholder(placeholder)
   .addOptions(
    ...entries.slice(0, selectLimit).map((entry) => {
     const option = new StringSelectMenuOptionBuilder()
      .setLabel(trim(entry.label, labelLimit))
      .setValue(entry.value)
      .setDefault(Boolean(entry.isDefault));

     if (entry.description) option.setDescription(trim(entry.description, descriptionLimit));

     return option;
    }),
   ),
 );

export const pageRow = (
 ctx: ViewContext,
 current: number,
 pages: number,
): ActionRowBuilder<ButtonBuilder> | null => {
 if (pages <= 1) return null;

 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(ctx.plugin.getRoute(HelpRoute.Page, ctx.sessionId, current - 1))
   .setEmoji(buttonEmoji(ctx.emotes.prev))
   .setDisabled(current === 1),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(ctx.plugin.getRoute(HelpRoute.Page, ctx.sessionId, current))
   .setLabel(`${ctx.t.base.t.Page()} ${current}/${pages}`)
   .setDisabled(true),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(ctx.plugin.getRoute(HelpRoute.Page, ctx.sessionId, current + 1))
   .setEmoji(buttonEmoji(ctx.emotes.next))
   .setDisabled(current === pages),
 );
};

export const backRow = (ctx: ViewContext): ActionRowBuilder<ButtonBuilder> =>
 new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(ctx.plugin.getRoute(HelpRoute.Home, ctx.sessionId))
   .setLabel(ctx.t.base.t.Back()),
 );

export const scopeRow = (ctx: ViewContext): ActionRowBuilder<StringSelectMenuBuilder> | null => {
 if (!ctx.data.settings.length) return null;

 return selectRow(ctx.plugin.getRoute(HelpRoute.Scope, ctx.sessionId), ctx.t.panel.scope(), [
  {
   label: ctx.t.base.t.Commands(),
   description: ctx.t.scope.commandsDescription(),
   value: HelpScope.Commands,
   isDefault: ctx.scope === HelpScope.Commands,
  },
  {
   label: ctx.t.scope.settings(),
   description: ctx.t.scope.settingsDescription(),
   value: HelpScope.Settings,
   isDefault: ctx.scope === HelpScope.Settings,
  },
 ]);
};

export const respondPanel = function (
 this: HelpPlugin,
 cmd: APIInteraction,
 containers: ContainerBuilder[],
 hide: boolean,
 via: RespondMode,
) {
 const payload = new MessagePayload(this.client, { origin: this.name, reason: 'Help panel' })
  .setAllowedMentionsUsers([])
  .setAllowedMentionsRoles([])
  .setComponents(containers.map((container) => container.toJSON()))
  .setFlags(MessageFlags.IsComponentsV2 | (hide ? MessageFlags.Ephemeral : 0));

 return via === RespondMode.Update ? payload.update(cmd) : payload.reply(cmd);
};

export const respondNotice = function (this: HelpPlugin, cmd: APIInteraction, content: string) {
 return new MessagePayload(this.client, { origin: this.name, reason: 'Help notice' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
