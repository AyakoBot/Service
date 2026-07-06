import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type { APIApplicationCommandInteraction } from 'discord-api-types/v10';

import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { line } from '../../Util/fmt.js';
import { respond, respondError } from '../../Util/respond.js';

export default async function (this: InfoPlugin, cmd: APIApplicationCommandInteraction) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const guild = await this.client.cache.guilds.get(cmd.guild_id);
 // eslint-disable-next-line @typescript-eslint/naming-convention
 const counted = (guild as { member_count?: number } | null)?.member_count;
 const memberCount = counted ?? (await this.client.cache.members.getAll(cmd.guild_id)).length;

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.member)} ${t.membercount.title()}`,
    line(emotes.member, t.base.t.Members(), `\`${memberCount.toLocaleString('en-US')}\``),
    `-# ${t.membercount.statbot()}`,
   ].join('\n'),
  ),
 );

 respond.call(this, cmd, [container], false);
}
