import type { RMessage } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ApplicationCommandType,
 ButtonStyle,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIMessageApplicationCommandInteraction,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoRoute } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { chunkByLength } from '../../Util/fmt.js';
import { respond, respondError, RespondVia, type Translator } from '../../Util/respond.js';

const contentPreviewCap = 500;

const quote = (content: string): string =>
 content
  .slice(0, contentPreviewCap)
  .split('\n')
  .map((entry) => `> ${entry}`)
  .join('\n') + (content.length > contentPreviewCap ? ' …' : '');

const metaLine = (t: Translator, version: RMessage): string =>
 [
  version.embeds.length ? `${t.base.t.Embeds()}: \`${version.embeds.length}\`` : null,
  version.attachments.length
   ? `${t.history.attachments()}: \`${version.attachments.length}\``
   : null,
  version.components?.length
   ? `${t.history.components()}: \`${version.components.length}\``
   : null,
  version.pinned ? t.history.pinned() : null,
  version.edited_timestamp
   ? `${t.history.editedAt()}: ${constants.formatters.getTime(
      new Date(version.edited_timestamp).getTime(),
     )}`
   : null,
 ]
  .filter((entry): entry is string => entry !== null)
  .join(' · ');

const versionBlock = (
 t: Translator,
 version: RMessage,
 time: number,
 index: number,
 previous: RMessage | null,
): string => {
 const lines = [`### ${index + 1}. ${constants.formatters.getTime(time)}`];

 if (previous && previous.content === version.content) {
  lines.push(`-# ${t.history.unchanged()}`);
 } else if (version.content) {
  lines.push(quote(version.content));
 } else {
  lines.push(`-# ${t.history.noContent()}`);
 }

 const meta = metaLine(t, version);
 if (meta) lines.push(`-# ${meta}`);

 return lines.join('\n');
};

const historyContainer = async function (
 this: InfoPlugin,
 emotes: EmoteSet,
 t: Translator,
 messageId: string,
 page: number,
): Promise<ContainerBuilder | null> {
 const times = (await this.client.cache.messages.getTimes(messageId)).sort((a, b) => a - b);
 if (!times.length) return null;

 const versions = await Promise.all(
  times.map((time) => this.client.cache.messages.getAt(time, messageId)),
 );

 const blocks: string[] = [];
 versions.forEach((version, index) => {
  if (!version) return;
  blocks.push(versionBlock(t, version, times[index], index, versions[index - 1] ?? null));
 });

 if (!blocks.length) return null;

 const chunks = chunkByLength(blocks);
 const currentPage = Math.min(Math.max(page, 1), chunks.length);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.log)} ${t.history.title()}`,
    `\`${messageId}\` · ${t.history.versions({ count: String(blocks.length) })}`,
   ].join('\n'),
  ),
 );
 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(chunks[currentPage - 1]),
 );

 if (chunks.length > 1) {
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.MsgHistoryPage, messageId, currentPage - 1))
     .setEmoji(buttonEmoji(emotes.prev))
     .setDisabled(currentPage === 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.MsgHistoryPage, messageId, 0))
     .setLabel(t.common.page({ page: String(currentPage), total: String(chunks.length) }))
     .setDisabled(true),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.MsgHistoryPage, messageId, currentPage + 1))
     .setEmoji(buttonEmoji(emotes.next))
     .setDisabled(currentPage === chunks.length),
   ),
  );
 }

 return container;
};

export default async function (this: InfoPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.Message) return;

 const interaction = cmd as APIMessageApplicationCommandInteraction;
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);

 const container = await historyContainer.call(this, emotes, t, interaction.data.target_id, 1);
 if (!container) {
  respondError.call(this, cmd, t.history.none());
  return;
 }

 respond.call(this, cmd, [container], true);
}

export const messageHistoryPage = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [messageId, pageArg] = args;
 if (!messageId) return;

 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);
 const page = Number(pageArg) || 1;

 const container = await historyContainer.call(this, emotes, t, messageId, page);
 if (!container) return;

 respond.call(this, cmd, [container], true, RespondVia.Update);
};
