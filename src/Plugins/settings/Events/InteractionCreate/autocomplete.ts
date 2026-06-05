import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandOptionChoice,
} from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';
import { hasManageGuild } from '../../Util/authorizeSettings.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 if (!cmd.guild_id || cmd.data.name !== 'settings') return;

 const api = await this.client.getAPI(cmd.guild_id);
 const respond = (choices: APIApplicationCommandOptionChoice[]) =>
  api.interactions.createAutocompleteResponse(
   cmd.id,
   cmd.token,
   { choices },
   { origin: this.name, reason: 'Settings id autocomplete' },
  );

 if (!hasManageGuild(cmd.member?.permissions)) {
  await respond([]);
  return;
 }

 const top = cmd.data.options?.[0];
 const sub =
  top?.type === ApplicationCommandOptionType.SubcommandGroup ? top.options?.[0] : top;
 if (!sub || sub.type !== ApplicationCommandOptionType.Subcommand) {
  await respond([]);
  return;
 }

 const resolved = resolveSchema(this.client, sub.name);
 if (!resolved) {
  await respond([]);
  return;
 }

 const idOption = sub.options?.find((option) => option.name === 'id');
 const query =
  idOption?.type === ApplicationCommandOptionType.String ? idOption.value.toLowerCase() : '';

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const rows = await this.client.db.client.ticketSetting.findMany({
  where: { guild: cmd.guild_id },
 });

 const choices = rows
  .map((row) => ({ name: schema.rowLabel(row), value: String(row.id) }))
  .filter(
   (choice) =>
    !query || choice.name.toLowerCase().includes(query) || choice.value.includes(query),
  )
  .slice(0, 25);

 await respond(choices);
}
