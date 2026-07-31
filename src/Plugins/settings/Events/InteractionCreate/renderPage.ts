import {
 MessageFlags,
 type APIInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { RespondMode } from '../../../../Util/respondMode.js';
import type SettingsPlugin from '../../Plugin.js';
import { buildGroupPage, visibleGroups } from '../../Util/buildGroupPage.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import guideActionState from '../../Util/guideActionState.js';
import { resolveVirtualFields } from '../../Util/resolveVirtualFields.js';

export interface RenderPageArgs {
 settingName: string;
 rowId: string;
 groupId?: string;
 hideUnavail: boolean;
 cmd: APIInteraction;
 respond: RespondMode;
}

export const renderPage = async function (this: SettingsPlugin, args: RenderPageArgs) {
 const { settingName, rowId, groupId, hideUnavail, cmd, respond } = args;
 if (!cmd.guild_id) return;

 const resolved = this.resolveSchema(settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const groups = visibleGroups(schema, row);
 const group = groups.find((g) => g.id === groupId) ?? groups[0];
 if (!group) return;

 const t = await this.t(cmd.guild_id);
 const api = await resolved.plugin.getAPI(cmd.guild_id);
 const displayRow = {
  ...row,
  ...(await resolveVirtualFields(group.fields, row, {
   client: this.client,
   plugin: resolved.plugin,
   guildId: cmd.guild_id,
  })),
 };
 const emotes = this.client.emojis.for(api);
 const actionState = schema.guide
  ? await guideActionState.call(this, {
     guide: schema.guide,
     row,
     plugin: resolved.plugin,
     guildId: cmd.guild_id,
    })
  : undefined;
 const page = buildGroupPage({
  settingName,
  schema,
  group,
  rowId,
  row: displayRow,
  hideUnavail,
  actionState,
  t,
  emotes,
 });

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Settings group page',
 })
  .setComponents(page.map((c) => c.toJSON() as APIMessageTopLevelComponent))
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);

 if (respond === RespondMode.Reply) payload.reply(cmd);
 else payload.update(cmd);
};
