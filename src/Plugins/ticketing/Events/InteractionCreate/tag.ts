import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import runSnippet from '../../Util/runSnippet.js';
import { buildToolkit } from '../../Util/tagToolkit.js';

export default async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;
 if (!cmd.guild_id) return;

 const command = cmd as APIChatInputApplicationCommandInteraction;
 const staffId = cmd.member?.user.id || cmd.user?.id;
 if (!staffId) return;

 const nameOption = command.data.options?.find((o) => o.name === 'tag');
 const name =
  nameOption?.type === ApplicationCommandOptionType.String ? nameOption.value : undefined;

 if (!name) {
  const snippets = await Snippet.all(this.client, cmd.guild_id);
  const payload = await buildToolkit.call(this, cmd.guild_id, snippets, { page: 0 });
  payload.reply(cmd);
  return;
 }

 const snippet = await Snippet.byName(this.client, cmd.guild_id, name);
 const t = await this.t(cmd.guild_id);

 if (!snippet) {
  new MessagePayload(this.client, { origin: this.name, reason: 'Snippet not found' })
   .setContent(`${t.tag.errors.notFound()}`)
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 await runSnippet.call(this, cmd, snippet, command.channel.id, staffId, cmd.guild_id);
}
