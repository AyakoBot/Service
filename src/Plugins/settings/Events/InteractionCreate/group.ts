
import { RequestHandlerError } from '@ayako/api';
import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import { buildGroupModal } from '../../Util/buildGroupModal.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const group = schema.groups.find((g) => g.id === id.groupId);
 if (!group) return;

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const modal = buildGroupModal(id.settingName, schema, group, id.rowId, row);

 const api = await this.client.getAPI(cmd.guild_id);
 const res = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Editing a settings group',
 });

 if (res instanceof RequestHandlerError) {
  this.nonFatalError(new Error('Failed to open the settings group modal', { cause: res }), 'group');
 }
}
