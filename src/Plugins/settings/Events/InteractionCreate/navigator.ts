
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
import { buildOverview } from '../../Util/buildOverview.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveChrome } from '../../Util/resolveChrome.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

const extractSettingName = (cmd: APIApplicationCommandInteraction): string | undefined => {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return undefined;

 const top = cmd.data.options?.[0];
 if (!top) return undefined;
 if (top.type === ApplicationCommandOptionType.SubcommandGroup) return top.options?.[0]?.name;
 if (top.type === ApplicationCommandOptionType.Subcommand) return top.name;
 return undefined;
};

const extractId = (cmd: APIApplicationCommandInteraction): string | undefined => {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return undefined;

 const top = cmd.data.options?.[0];
 if (!top) return undefined;

 const sub =
  top.type === ApplicationCommandOptionType.SubcommandGroup
   ? top.options?.[0]
   : top.type === ApplicationCommandOptionType.Subcommand
     ? top
     : undefined;
 if (!sub || sub.type !== ApplicationCommandOptionType.Subcommand) return undefined;

 const option = sub.options?.find((o) => o.name === 'id');
 if (!option || option.type !== ApplicationCommandOptionType.String) return undefined;
 return option.value;
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
 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const requestedId = extractId(cmd);

 if (requestedId) {
  const row = await this.client.db.client.ticketSetting.findFirst({
   where: { id: requestedId, guild: cmd.guild_id },
  });

  if (row) {
   const chrome = await resolveChrome.call(this, cmd.guild_id);
   const container = buildNavigator(settingName, schema, String(row.id), row, chrome);

   new MessagePayload(this.client, { origin: this.name, reason: 'Settings navigator' })
    .setComponents([container.toJSON() as APIMessageTopLevelComponent])
    .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
    .reply(cmd);
   return;
  }
 }

 const rows = await this.client.db.client.ticketSetting.findMany({
  where: { guild: cmd.guild_id },
 });

 const overview = buildOverview(
  t.navigator.overviewTitle(),
  t.navigator.create(),
  t.base.t.Edit(),
  t.navigator.overviewEmpty(),
  settingName,
  schema,
  rows,
 );

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings overview' })
  .setComponents([overview.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .reply(cmd);
};

export const reRender = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 if (!id.rowId) {
  const t = await this.t(cmd.guild_id);

  const rows = await this.client.db.client.ticketSetting.findMany({
   where: { guild: cmd.guild_id },
  });

  const overview = buildOverview(
   t.navigator.overviewTitle(),
   t.navigator.create(),
   t.base.t.Edit(),
   t.navigator.overviewEmpty(),
   id.settingName,
   schema,
   rows,
  );

  new MessagePayload(this.client, { origin: this.name, reason: 'Settings overview re-render' })
   .setComponents([overview.toJSON() as APIMessageTopLevelComponent])
   .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
   .update(cmd);
  return;
 }

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const chrome = await resolveChrome.call(this, cmd.guild_id);
 const container = buildNavigator(id.settingName, schema, id.rowId, row, chrome);

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings navigator re-render' })
  .setComponents([container.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
};
