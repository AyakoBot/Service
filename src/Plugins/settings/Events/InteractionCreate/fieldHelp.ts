import type { APIMessageComponentInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.column) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const field = schema.groups.flatMap((g) => g.fields).find((f) => f.column === id.column);
 if (!field?.help) return;

 ephemeralNote.call(this, cmd, field.help.text);
}
