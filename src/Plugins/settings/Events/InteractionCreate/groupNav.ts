import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { RespondMode } from '../../../../Util/respondMode.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';

import { renderPage } from './renderPage.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const selected =
  cmd.data.component_type === ComponentType.StringSelect ? cmd.data.values[0] : undefined;
 const groupId = id.groupId ?? selected;
 if (!groupId) return;

 await renderPage.call(this, {
  settingName: id.settingName,
  rowId: id.rowId,
  groupId,
  hideUnavail: Boolean(id.hideUnavail),
  cmd,
  respond: RespondMode.Update,
 });
}
