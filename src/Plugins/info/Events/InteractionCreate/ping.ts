import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type { APIApplicationCommandInteraction } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import { line } from '../../../../Util/fmt.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { respond, type Translator } from '../../Util/respond.js';

const pingContainer = (
 emotes: EmoteSet,
 t: Translator,
 deliveryMs: number | null,
 roundtripMs: number | null,
) =>
 new ContainerBuilder().setAccentColor(Colors.Info).addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.timer)} ${t.ping.title()}`,
    line(
     emotes.send,
     t.ping.delivery(),
     deliveryMs === null
      ? t.base.t.Unknown()
      : `\`${deliveryMs}\` ${t.base.time.milliseconds()}`,
    ),
    line(
     emotes.refresh,
     t.ping.roundtrip(),
     roundtripMs === null
      ? t.ping.measuring()
      : `\`${roundtripMs}\` ${t.base.time.milliseconds()}`,
    ),
   ].join('\n'),
  ),
 );

export default async function (this: InfoPlugin, cmd: APIApplicationCommandInteraction) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);

 const started = Date.now();
 const createdMs = snowflakeToMs(cmd.id);
 const deliveryMs = createdMs === null ? null : Math.max(started - createdMs, 0);

 await respond.call(this, cmd, [pingContainer(emotes, t, deliveryMs, null)], true);
 const roundtripMs = Date.now() - started;

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  '@original',
  { components: [pingContainer(emotes, t, deliveryMs, roundtripMs).toJSON()] },
  { origin: this.name, reason: 'Updating ping panel with roundtrip' },
 );
}
