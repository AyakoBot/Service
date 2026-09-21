import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, SeparatorSpacingSize } from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';
import { fleetEntries, type FleetEntry } from '../Classes/FleetRegistry.js';
import { accentColor, codeCommand, type Translator, type ViewContext } from '../Util/render.js';

const websiteUrl = 'https://ayakobot.com/';

const lineFor = (t: Translator, emotes: EmoteSet, entry: FleetEntry): string => {
 const labels = t.bots[entry.bot];
 const link = entry.appId
  ? `[${t.fleet.invite({ bot: labels.label() })}](${constants.standard.botAddUrl(entry.appId)})`
  : t.fleet.unavailable();

 return `${textEmote(emotes.info)} **${labels.label()}** ${labels.blurb()} ${link}`;
};

export default function (ctx: ViewContext) {
 const container = new ContainerBuilder().setAccentColor(accentColor());

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${ctx.t.fleet.title()}\n${ctx.t.fleet.intro({ bot: ctx.data.botName })}`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 const entries = fleetEntries();

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   entries.map((entry) => lineFor(ctx.t, ctx.emotes, entry)).join('\n'),
  ),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(ctx.t.fleet.hint({ help: codeCommand('help') })),
 );

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(websiteUrl)
    .setLabel(ctx.t.fleet.website()),
  ),
 );

 return container;
}
