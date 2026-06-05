import {
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import { buildNavigator } from '../../Util/buildNavigator.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const t = await this.t(cmd.guild_id);

 const created = await this.client.db.client.ticketSetting
  .create({
   data: {
    id: String(Date.now()),
    guild: cmd.guild_id,
    active: false,
   },
  })
  .catch((error: Error) => error);

 if (created instanceof Error) {
  this.nonFatalError(created, 'settingsCreate');

  new MessagePayload(this.client, { origin: this.name, reason: 'Settings create' })
   .setContent(t.base.errors.unknownError())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const container = buildNavigator(id.settingName, schema, String(created.id), created);

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings create navigator' })
  .setComponents([container.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
}
