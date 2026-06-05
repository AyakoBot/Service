
import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import { buildNavigator } from '../../Util/buildNavigator.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

const extractSettingName = (cmd: APIApplicationCommandInteraction): string | undefined => {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return undefined;

 const top = cmd.data.options?.[0];
 if (!top) return undefined;
 if (top.type === ApplicationCommandOptionType.SubcommandGroup) return top.options?.[0]?.name;
 if (top.type === ApplicationCommandOptionType.Subcommand) return top.name;
 return undefined;
};

export const openFromCommand = async function (
 this: SettingsPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (!cmd.guild_id) return;

 const settingName = extractSettingName(cmd);
 if (!settingName) return;

 const resolved = resolveSchema(this.client, settingName);
 if (!resolved) return;

 const t = await this.t(cmd.guild_id);

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { guild: cmd.guild_id },
 });

 if (!row) {
  new MessagePayload(this.client, { origin: this.name, reason: 'Settings no system' })
   .setContent(t.navigator.noSystemConfigured())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const container = buildNavigator(settingName, schema, String(row.id), row);

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings navigator' })
  .setComponents([container.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .reply(cmd);
};

export const reRender = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const container = buildNavigator(id.settingName, schema, id.rowId, row);

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings navigator re-render' })
  .setComponents([container.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
};
