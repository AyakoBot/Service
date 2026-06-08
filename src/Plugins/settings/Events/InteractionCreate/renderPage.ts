import {
 MessageFlags,
 type APIInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import { buildGroupPage } from '../../Util/buildGroupPage.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

export interface RenderPageArgs {
 settingName: string;
 rowId: string;
 groupId?: string;
 hideUnavail: boolean;
 cmd: APIInteraction;
 respond: 'reply' | 'update';
}

export const renderPage = async function (this: SettingsPlugin, args: RenderPageArgs) {
 const { settingName, rowId, groupId, hideUnavail, cmd, respond } = args;
 if (!cmd.guild_id) return;

 const resolved = this.resolveSchema(settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const group = schema.groups.find((g) => g.id === groupId) ?? schema.groups[0];
 if (!group) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const t = await this.t(cmd.guild_id);
 const page = buildGroupPage({
  settingName,
  schema,
  group,
  rowId,
  row,
  hideUnavail,
  t,
 });

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Settings group page',
 })
  .setComponents(page.map((c) => c.toJSON() as APIMessageTopLevelComponent))
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);

 if (respond === 'reply') payload.reply(cmd);
 else payload.update(cmd);
};
