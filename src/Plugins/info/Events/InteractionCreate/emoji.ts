import type { REmoji } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import { chunkByLength, codeId, line, timeOf, yesNo } from '../../../../Util/fmt.js';
import { getStringOption } from '../../../../Util/interactionOptions.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { InfoRoute } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { getHide, respond, respondError, RespondVia, type Translator } from '../../Util/respond.js';

const emojiIdPattern = /^(?:<(?<animated>a)?:(?<name>\w+):)?(?<id>\d{15,21})>?$/;

const singleContainer = (emotes: EmoteSet, t: Translator, emoji: REmoji): ContainerBuilder => {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.emoji)} ${t.emoji.title()}`,
    line(emotes.info, t.base.t.name(), `\`${emoji.name}\``),
    line(emotes.number, t.common.id(), codeId(emoji.id)),
    line(emotes.link, t.common.url(), `[${t.base.t.Open()}](${emoji.url})`),
    line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(emoji.id), t.base)),
    line(emotes.image, t.emoji.animated(), yesNo(emotes, t.base, Boolean(emoji.animated))),
    line(emotes.enabled, t.emoji.available(), yesNo(emotes, t.base, emoji.available !== false)),
    line(emotes.settings, t.emoji.managed(), yesNo(emotes, t.base, Boolean(emoji.managed))),
    emoji.roles?.length
     ? line(emotes.role, t.emoji.roles(), emoji.roles.map((id) => `<@&${id}>`).join(' '))
     : null,
   ]
    .filter((entry): entry is string => entry !== null)
    .join('\n'),
  ),
 );

 container.addMediaGalleryComponents(
  new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(emoji.url)),
 );

 return container;
};

const listContainer = function (
 this: InfoPlugin,
 emotes: EmoteSet,
 t: Translator,
 all: REmoji[],
 page: number,
): ContainerBuilder {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 const lines = all.map(
  (emoji) => `${constants.formatters.getEmote(emoji)} \`${emoji.name}\` ${codeId(emoji.id)}`,
 );
 const chunks = chunkByLength(lines);
 const currentPage = Math.min(Math.max(page, 1), chunks.length);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.emoji)} ${t.emoji.listTitle()}\n${chunks[currentPage - 1]}`,
  ),
 );

 if (chunks.length > 1) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.EmojiPage, currentPage - 1))
     .setEmoji(buttonEmoji(emotes.prev))
     .setDisabled(currentPage === 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.EmojiPage, 0))
     .setLabel(t.common.page({ page: String(currentPage), total: String(chunks.length) }))
     .setDisabled(true),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.EmojiPage, currentPage + 1))
     .setEmoji(buttonEmoji(emotes.next))
     .setDisabled(currentPage === chunks.length),
   ),
  );
 }

 return container;
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);
 const input = getStringOption(sub, InfoOption.Emoji).trim();

 if (input) {
  const match = input.match(emojiIdPattern);
  const emoji = match?.groups?.id
   ? await this.client.cache.emojis.get(match.groups.id)
   : null;
  if (!emoji) {
   respondError.call(this, cmd, t.errors.emojiNotFound());
   return;
  }
  respond.call(this, cmd, [singleContainer(emotes, t, emoji)], getHide(sub));
  return;
 }

 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const all = await this.client.cache.emojis.getAll(cmd.guild_id);
 if (!all.length) {
  respondError.call(this, cmd, t.emoji.none());
  return;
 }

 respond.call(this, cmd, [listContainer.call(this, emotes, t, all, 1)], getHide(sub));
}

export const emojiPage = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);
 const page = Number(args[0]) || 1;

 const all = await this.client.cache.emojis.getAll(cmd.guild_id);
 respond.call(
  this,
  cmd,
  [listContainer.call(this, emotes, t, all, page)],
  true,
  RespondVia.Update,
 );
};
