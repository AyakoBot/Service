import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import { chunkByLength, codeId } from '../../../../Util/fmt.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
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

 const sounds = await this.client.cache.soundboards.getAll(cmd.guild_id);
 if (!sounds.length) {
  respondError.call(this, cmd, t.soundboard.none());
  return;
 }

 const lines = sounds.map((sound) =>
  [
   `${
    constants.formatters.getEmote({
     name: sound.emoji_name,
     id: sound.emoji_id ?? undefined,
    }) ?? textEmote(emotes.emoji)
   } \`${sound.name}\` ${codeId(sound.sound_id)}`,
   `> ${t.soundboard.volume()}: \`${Math.round(sound.volume * 100)}%\`${
    sound.user_id ? ` · ${t.common.uploader()}: <@${sound.user_id}>` : ''
   }`,
  ].join('\n'),
 );

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.soundboard)} ${t.soundboard.title()} (\`${sounds.length}\`)\n${chunkByLength(lines)[0]}`,
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
