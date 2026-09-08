import { MessageFlags, type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import Snippet, { type SnippetData } from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { snippetConflict } from '../../Util/snippetConflict.js';
import { snippetErrorText } from '../../Util/snippetErrorText.js';
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

const readForm = (cmd: APIModalSubmitInteraction): SnippetData => ({
 name: (findModalValue(cmd.data.components, 'name') || '').trim(),
 trigger: (findModalValue(cmd.data.components, 'trigger') || '').trim() || null,
 userText: findModalValue(cmd.data.components, 'userText') || '',
 staffText: findModalValue(cmd.data.components, 'staffText') || '',
 kinds: (findModalValue(cmd.data.components, 'kinds') || '')
  .split(',')
  .map((kind) => kind.trim())
  .filter((kind) => kind.length > 0),
});

const saveSnippet = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 guildId: string,
 editId?: string,
) {
 const data = readForm(cmd);
 const t = await this.t(guildId);
 const vars = { name: data.name, trigger: data.trigger || '' };

 if (!data.name) {
  reply.call(this, cmd, t.tag.errors.nameRequired());
  return;
 }

 const conflict = await snippetConflict.call(this, guildId, data, editId);
 if (conflict) {
  reply.call(this, cmd, snippetErrorText(t, conflict, vars));
  return;
 }

 const saved = await (editId
  ? Snippet.update(this.client, editId, data)
  : Snippet.create(this.client, guildId, data)
 ).catch((error: Error) => error);

 if (saved instanceof Error) {
  reply.call(this, cmd, snippetErrorText(t, saved.message, vars));
  return;
 }

 const all = await Snippet.all(this.client, guildId);
 const payload = await buildToolkit.call(this, guildId, all, { page: 0, manage: true });
 payload.update(cmd);
};

export const tagAddModal = async function (this: TicketPlugin, cmd: APIModalSubmitInteraction) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 await saveSnippet.call(this, cmd, cmd.guild_id);
};

export const tagEditModal = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 await saveSnippet.call(this, cmd, cmd.guild_id, args[0]);
};

const reply = function (this: TicketPlugin, cmd: APIModalSubmitInteraction, content: string) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Snippet authoring result' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
