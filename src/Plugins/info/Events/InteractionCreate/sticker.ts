import { RequestHandlerError } from '@ayako/api';
import type { RSticker } from '@ayako/utility';
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
 StickerFormatType,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { getStringOption } from '../../../../Util/interactionOptions.js';
import { messageLinkPattern } from '../../../../Util/messageLink.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { InfoRoute } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { chunkByLength, codeId, line, nameOf, timeOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError, RespondVia, type Translator } from '../../Util/respond.js';

const singleContainer = (t: Translator, sticker: RSticker): ContainerBuilder => {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.sticker)} ${t.sticker.title()}`,
    line(emotes.info, t.base.t.name(), `\`${sticker.name}\``),
    sticker.description
     ? line(emotes.paragraph, t.base.t.Description(), `\`${sticker.description}\``)
     : null,
    line(emotes.number, t.common.id(), codeId(sticker.id)),
    line(emotes.link, t.common.url(), `[${t.base.t.Open()}](${sticker.url})`),
    line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(sticker.id), t.base)),
    line(
     emotes.image,
     t.sticker.format(),
     nameOf(t.sticker.formatNames, sticker.format_type, t.base.t.Unknown()),
    ),
    line(emotes.enabled, t.sticker.available(), yesNo(t.base, sticker.available !== false)),
    sticker.tags ? line(emotes.emoji, t.sticker.tags(), `\`${sticker.tags}\``) : null,
   ]
    .filter((entry): entry is string => entry !== null)
    .join('\n'),
  ),
 );

 if (sticker.format_type !== StickerFormatType.Lottie) {
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(sticker.url)),
  );
 }

 return container;
};

const listContainer = function (
 this: InfoPlugin,
 t: Translator,
 all: RSticker[],
 page: number,
): ContainerBuilder {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 const lines = all.map((sticker) => `\`${sticker.name}\` ${codeId(sticker.id)}`);
 const chunks = chunkByLength(lines);
 const currentPage = Math.min(Math.max(page, 1), chunks.length);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.sticker)} ${t.sticker.listTitle()}\n${chunks[currentPage - 1]}`,
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
     .setCustomId(this.getRoute(InfoRoute.StickerPage, currentPage - 1))
     .setEmoji(buttonEmoji(emotes.prev))
     .setDisabled(currentPage === 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.StickerPage, 0))
     .setLabel(t.common.page({ page: String(currentPage), total: String(chunks.length) }))
     .setDisabled(true),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.StickerPage, currentPage + 1))
     .setEmoji(buttonEmoji(emotes.next))
     .setDisabled(currentPage === chunks.length),
   ),
  );
 }

 return container;
};

const resolveSticker = async function (
 this: InfoPlugin,
 guildId: string,
 input: string,
): Promise<RSticker | null> {
 const linkMatch = input.match(messageLinkPattern);
 if (linkMatch) {
  const api = await this.getAPI(guildId);
  const message = await api.channels.getMessage(linkMatch[2], linkMatch[3], {
   origin: this.name,
   reason: 'Resolving sticker from message link',
  });
  if (message instanceof RequestHandlerError) return null;
  const stickerId = message.sticker_items?.[0]?.id;
  return stickerId ? this.client.cache.stickers.get(stickerId) : null;
 }

 if (/^\d{15,21}$/.test(input)) return this.client.cache.stickers.get(input);
 return null;
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const input = getStringOption(sub, InfoOption.Sticker).trim();
 if (input) {
  const sticker = await resolveSticker.call(this, cmd.guild_id, input);
  if (!sticker) {
   respondError.call(this, cmd, t.errors.stickerNotFound());
   return;
  }
  respond.call(this, cmd, [singleContainer(t, sticker)], getHide(sub));
  return;
 }

 const all = await this.client.cache.stickers.getAll(cmd.guild_id);
 if (!all.length) {
  respondError.call(this, cmd, t.sticker.none());
  return;
 }

 respond.call(this, cmd, [listContainer.call(this, t, all, 1)], getHide(sub));
}

export const stickerPage = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);
 const page = Number(args[0]) || 1;

 const all = await this.client.cache.stickers.getAll(cmd.guild_id);
 respond.call(this, cmd, [listContainer.call(this, t, all, page)], true, RespondVia.Update);
};
