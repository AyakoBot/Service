import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
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

import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoRoute } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { chunkByLength } from '../../Util/fmt.js';
import { getHide, respond, respondError, RespondVia, type Translator } from '../../Util/respond.js';

const listContainer = async function (
 this: InfoPlugin,
 t: Translator,
 page: number,
): Promise<ContainerBuilder | null> {
 const guilds = await this.client.cache.guilds.getAll();
 if (!guilds.length) return null;

 const lines = guilds
  .map((guild) => ({
   guild,
   // eslint-disable-next-line @typescript-eslint/naming-convention
   members: (guild as { member_count?: number }).member_count ?? 0,
  }))
  .sort((a, b) => b.members - a.members)
  .map(
   ({ guild, members }) =>
    `\`${guild.name}\`\n> ${t.servers.members({ count: String(members) })}${
     guild.vanity_url_code
      ? ` · [${t.base.t.Join()}](https://discord.gg/${guild.vanity_url_code})`
      : ''
    }`,
  );

 const chunks = chunkByLength(lines);
 const currentPage = Math.min(Math.max(page, 1), chunks.length);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.server)} ${t.servers.title()} (\`${guilds.length}\`)\n${chunks[currentPage - 1]}`,
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
     .setCustomId(this.getRoute(InfoRoute.ServersPage, currentPage - 1))
     .setEmoji(buttonEmoji(emotes.prev))
     .setDisabled(currentPage === 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.ServersPage, 0))
     .setLabel(t.common.page({ page: String(currentPage), total: String(chunks.length) }))
     .setDisabled(true),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.ServersPage, currentPage + 1))
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

 const container = await listContainer.call(this, t, 1);
 if (!container) {
  respondError.call(this, cmd, t.servers.none());
  return;
 }

 respond.call(this, cmd, [container], getHide(sub));
}

export const serversPage = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const page = Number(args[0]) || 1;

 const container = await listContainer.call(this, t, page);
 if (!container) return;

 respond.call(this, cmd, [container], true, RespondVia.Update);
};
