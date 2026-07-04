import { MessageFlags, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import { SettingsAction } from '../../Util/customId.js';
import type { SettingsId } from '../../Util/customId.js';

import { renderGuide } from './navigator.js';
import { renderPage } from './renderPage.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;
 if (!resolved.schema.multiRow) return;

 const t = await this.t(cmd.guild_id);

 const created = await this.tableClient(resolved.schema.table)
  .create({
   data: {
    id: String(Date.now()),
    guild: cmd.guild_id,
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

 if (resolved.schema.guide) {
  await renderGuide.call(this, cmd, {
   action: SettingsAction.Guide,
   settingName: id.settingName,
   rowId: String(created.id),
   groupId: resolved.schema.groups[0]?.id,
   guideFlags: 0,
  });
  return;
 }

 await renderPage.call(this, {
  settingName: id.settingName,
  rowId: String(created.id),
  hideUnavail: true,
  cmd,
  respond: 'update',
 });
}
