import type { Snippets } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import { PageDirection } from '../Classes/Enums.js';
import { TicketRoute } from '../Classes/Routes.js';
import type TicketPlugin from '../Plugin.js';

export const pageSize = 5;

const preview = (snippet: Snippets, max = 80) => {
 const raw = (snippet.userText || snippet.staffText || '').replace(/[\n\r]+/g, ' ').trim();
 if (!raw) return '';
 return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
};

export const filterSnippets = (snippets: Snippets[], query: string) => {
 const q = query.trim().toLowerCase();
 if (!q) return snippets;
 return snippets.filter(
  (s) =>
   s.name.toLowerCase().includes(q) ||
   (s.userText || '').toLowerCase().includes(q) ||
   (s.staffText || '').toLowerCase().includes(q),
 );
};

export const buildToolkit = async function (
 this: TicketPlugin,
 guildId: string,
 snippets: Snippets[],
 opts: { page: number; query?: string; manage?: boolean },
) {
 const t = await this.t(guildId);
 const pageCount = Math.max(1, Math.ceil(snippets.length / pageSize));
 const page = Math.min(Math.max(0, opts.page), pageCount - 1);
 const slice = snippets.slice(page * pageSize, page * pageSize + pageSize);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `${constants.formatters.getEmote(emotes.ticket)} **${t.tag.toolkitHeader()}**`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 if (!slice.length) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t.tag.noSnippets()));
 }

 slice.forEach((snippet) => {
  const body = preview(snippet);
  const label = `**${snippet.name}**${body ? `\n-# ${body}` : ''}`;

  const accessory = opts.manage
   ? new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId(this.getRoute(TicketRoute.TagDelete, snippet.id))
      .setLabel(t.base.t.Delete())
   : new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setCustomId(this.getRoute(TicketRoute.TagSend, snippet.id))
      .setLabel(t.tag.send());

  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(label))
    .setButtonAccessory(accessory),
  );
 });

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `-# ${t.base.t.Page()} ${page + 1}/${pageCount}\n-# ${t.tag.commandReference()}`,
  ),
 );

 const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.TagPage, PageDirection.Prev, page))
   .setLabel('←')
   .setDisabled(page <= 0),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.TagPage, PageDirection.Next, page))
   .setLabel('→')
   .setDisabled(page >= pageCount - 1),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.TagSearch))
   .setLabel(t.tag.search()),
 );

 const toggleRoute = opts.manage ? TicketRoute.TagBrowse : TicketRoute.TagManage;
 const manageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(TicketRoute.TagAdd))
   .setLabel(t.base.t.Add()),
  new ButtonBuilder()
   .setStyle(opts.manage ? ButtonStyle.Primary : ButtonStyle.Secondary)
   .setCustomId(this.getRoute(toggleRoute))
   .setLabel(opts.manage ? t.tag.browse() : t.tag.manage()),
 );

 const components: APIMessageTopLevelComponent[] = [
  container.toJSON(),
  nav.toJSON() as unknown as APIMessageTopLevelComponent,
  manageRow.toJSON() as unknown as APIMessageTopLevelComponent,
 ];

 return new MessagePayload(this.client, { origin: this.name, reason: 'Snippet toolkit' })
  .setComponents(components)
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};
