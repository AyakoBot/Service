import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { RespondMode } from '../../../../Util/respondMode.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';

import { renderPage } from './renderPage.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId) return;

 await renderPage.call(this, {
  settingName: id.settingName,
  rowId: id.rowId,
  groupId: id.groupId,
  hideUnavail: Boolean(id.hideUnavail),
  cmd,
  respond: RespondMode.Update,
 });
}
