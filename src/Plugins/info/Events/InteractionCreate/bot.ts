import os from 'node:os';

import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import pkg from '../../../../../package.json' with { type: 'json' };
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import { line } from '../../../../Util/fmt.js';
import formatDuration from '../../../../Util/formatDuration.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { getHide, respond } from '../../Util/respond.js';

import { resolveUser } from './user.js';

const gb = 1024 ** 3;

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);

 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);
 const botUser = await resolveUser.call(this, api.botId);
 const guilds = await this.client.cache.guilds.getAll();

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.bot)} ${t.bot.title()}`,
    botUser
     ? line(emotes.info, t.base.t.name(), `**${constants.formatters.user(botUser)}**`)
     : null,
    line(emotes.number, t.common.id(), `\`${api.botId}\``),
    line(emotes.info, t.base.t.Servers(), `\`${guilds.length}\``),
   ]
    .filter((entry): entry is string => entry !== null)
    .join('\n'),
  ),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   t.bot.base({
    base: api.botId === process.env.mainId ? ' ' : `(${t.bot.thisBase()}) `,
    version: pkg.version,
   }),
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    line(emotes.timer, t.bot.uptime(), `\`${formatDuration(Math.round(process.uptime() * 1000))}\``),
    line(
     emotes.brain,
     t.bot.memory(),
     `\`${((os.totalmem() - os.freemem()) / gb).toFixed(1)}GB\` / \`${(os.totalmem() / gb).toFixed(1)}GB\``,
    ),
    line(emotes.cpu, t.bot.cpu(), `\`${os.cpus()[0]?.model.trim() ?? t.base.t.Unknown()}\``),
    line(emotes.settings, t.bot.os(), `\`${os.type()} ${os.arch()}\``),
    line(emotes.command, t.bot.nodeVersion(), `\`${process.version}\``),
   ].join('\n'),
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
