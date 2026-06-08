import { MessageFlags, type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { SnippetErrors } from '../../Classes/Enums.js';
import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { findModalValue } from '../../Util/findModalValue.js';
import { buildToolkit, filterSnippets } from '../../Util/tagToolkit.js';

export const tagSearchModal = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
) {
 if (!cmd.guild_id) return;

 const query = findModalValue(cmd.data.components, 'query') || '';
 const all = await Snippet.all(this.client, cmd.guild_id);
 const filtered = filterSnippets(all, query);

 const payload = await buildToolkit.call(this, cmd.guild_id, filtered, { page: 0, query });
 payload.update(cmd);
};

export const tagAddModal = async function (this: TicketPlugin, cmd: APIModalSubmitInteraction) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const name = (findModalValue(cmd.data.components, 'name') || '').trim();
 const userText = findModalValue(cmd.data.components, 'userText') || '';
 const staffText = findModalValue(cmd.data.components, 'staffText') || '';
 const kinds = (findModalValue(cmd.data.components, 'kinds') || '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

 const t = await this.t(cmd.guild_id);

 if (!name) {
  reply.call(this, cmd, t.tag.errors.nameRequired());
  return;
 }

 const saved = await Snippet.create(this.client, cmd.guild_id, {
  name,
  userText,
  staffText,
  kinds,
 }).catch((error: Error) => error);

 if (saved instanceof Error) {
  reply.call(
   this,
   cmd,
   saved.message === SnippetErrors.emptySnippet
    ? t.tag.errors.emptySnippet()
    : t.base.errors.unknownError(),
  );
  return;
 }

 reply.call(this, cmd, t.tag.saved({ name }));
};

const reply = function (this: TicketPlugin, cmd: APIModalSubmitInteraction, content: string) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Snippet authoring result' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
