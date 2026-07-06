import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 GuildScheduledEventEntityType,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { codeId, line, nameOf, timeOf } from '../../Util/fmt.js';
import { getHide, respond, respondError } from '../../Util/respond.js';

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

 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const events = await this.client.cache.events.getAll(cmd.guild_id);
 if (!events.length) {
  respondError.call(this, cmd, t.events.none());
  return;
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.event)} ${t.events.title()} (\`${events.length}\`)`,
  ),
 );

 events
  .sort(
   (a, b) =>
    new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime(),
  )
  .forEach((event) => {
   container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
   );
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     [
      `### ${event.name}`,
      event.description ? `-# ${event.description}` : null,
      line(emotes.number, t.common.id(), codeId(event.id)),
      line(
       emotes.calendar,
       t.events.startsAt(),
       timeOf(new Date(event.scheduled_start_time).getTime(), t.base),
      ),
      event.scheduled_end_time
       ? line(
          emotes.calendar,
          t.events.endsAt(),
          timeOf(new Date(event.scheduled_end_time).getTime(), t.base),
         )
       : null,
      line(
       emotes.info,
       t.events.status(),
       nameOf(t.events.statusNames, event.status, t.base.t.Unknown()),
      ),
      event.entity_type === GuildScheduledEventEntityType.External
       ? line(
          emotes.link,
          t.events.location(),
          `\`${event.entity_metadata?.location ?? t.base.t.Unknown()}\``,
         )
       : event.channel_id
         ? line(emotes.channelvoice, t.base.t.Channel(), `<#${event.channel_id}>`)
         : null,
      event.creator_id ? line(emotes.member, t.events.creator(), `<@${event.creator_id}>`) : null,
      event.user_count !== undefined
       ? line(emotes.member, t.events.interested(), `\`${event.user_count}\``)
       : null,
     ]
      .filter((entry): entry is string => entry !== null)
      .join('\n'),
    ),
   );
  });

 respond.call(this, cmd, [container], getHide(sub));
}
