import {
 ComponentType,
 MessageFlags,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { dropPick, loadPick } from '../../Util/contactPick.js';
import { outcomeContainer, postSnippet, TagFeedback } from '../../Util/runSnippet.js';
import showCommandError from '../../Util/showCommandError.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect || !cmd.guild_id) return;

 const [pickId = ''] = args;
 const [systemId] = cmd.data.values;
 const t = await this.t(cmd.guild_id);

 const pending = await loadPick.call(this, pickId);
 if (!pending || !systemId) {
  showCommandError.call(this.client, t.tag.commands.pickExpired(), cmd, t.base);
  return;
 }
 if (cmd.member?.user.id !== pending.staffId) {
  showCommandError.call(this.client, t.tag.commands.pickNotYours(), cmd, t.base);
  return;
 }

 const snippet = await Snippet.byId(this.client, pending.snippetId);
 if (!snippet) {
  showCommandError.call(this.client, t.tag.errors.notFound(), cmd, t.base);
  return;
 }

 await dropPick.call(this, pickId);

 const api = await this.getInteractionAPI(cmd);
 const meta = { origin: this.name, reason: 'Opening a snippet contact' };
 await api.interactions.deferMessageUpdate(cmd.id, cmd.token, {}, meta);

 const outcome = await postSnippet.call(this, snippet, {
  ...pending,
  feedback: TagFeedback.Note,
  systemId,
 });
 const emotes = this.client.emojis.forApp(cmd.application_id);

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  '@original',
  {
   components: [outcomeContainer(t, emotes, snippet, outcome, '').toJSON()],
   flags: MessageFlags.IsComponentsV2,
   allowed_mentions: { parse: [] },
  },
  meta,
 );
}
