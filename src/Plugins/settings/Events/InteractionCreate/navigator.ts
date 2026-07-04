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
import { buildGuidePage } from '../../Util/buildGuidePage.js';
import { buildOverview } from '../../Util/buildOverview.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import guideActionState from '../../Util/guideActionState.js';

import { renderPage } from './renderPage.js';

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

const sendOverview = async function (
 this: SettingsPlugin,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
 settingName: string,
 respond: 'reply' | 'update',
) {
 if (!cmd.guild_id) return;

 const resolved = this.resolveSchema(settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const t = await this.t(cmd.guild_id);

 const rows = await this.tableClient(resolved.schema.table).findMany({
  where: { guild: cmd.guild_id },
 });

 const overview = buildOverview({
  title: schema.title ?? t.navigator.overviewTitle(),
  description: schema.overviewDescription,
  createLabel: t.navigator.create(),
  editLabel: t.base.t.Edit(),
  emptyText: t.navigator.overviewEmpty(),
  settingName,
  schema,
  rows,
 });

 const payload = new MessagePayload(this.client, { origin: this.name, reason: 'Settings overview' })
  .setComponents([overview.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);

 if (respond === 'reply') payload.reply(cmd);
 else payload.update(cmd);
};

export const openFromCommand = async function (
 this: SettingsPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (!cmd.guild_id) return;

 const settingName = extractSettingName(cmd);
 if (!settingName) return;

 const resolved = this.resolveSchema(settingName);
 if (!resolved) return;

 if (resolved.schema.multiRow) {
  const requestedId = extractId(cmd);

  if (requestedId) {
   const row = await this.tableClient(resolved.schema.table).findFirst({
    where: { id: requestedId, guild: cmd.guild_id },
   });

   if (row) {
    await renderPage.call(this, {
     settingName,
     rowId: String(row.id),
     hideUnavail: true,
     cmd,
     respond: 'reply',
    });
    return;
   }
  }

  await sendOverview.call(this, cmd, settingName, 'reply');
  return;
 }

 const delegate = this.tableClient(resolved.schema.table);
 const row =
  (await delegate.findFirst({ where: { guild: cmd.guild_id } })) ??
  (await delegate.create({ data: { id: cmd.guild_id, guild: cmd.guild_id } }));

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const [firstGroup] = schema.groups;
 if (!firstGroup) return;

 await renderPage.call(this, {
  settingName,
  rowId: String(row[schema.rowKey]),
  groupId: firstGroup.id,
  hideUnavail: true,
  cmd,
  respond: 'reply',
 });
};

export const reRender = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id) return;

 if (!id.rowId) {
  await sendOverview.call(this, cmd, id.settingName, 'update');
  return;
 }

 if (id.guideFlags !== undefined) {
  await renderGuide.call(this, cmd, id);
  return;
 }

 await renderPage.call(this, {
  settingName: id.settingName,
  rowId: id.rowId,
  groupId: id.groupId,
  hideUnavail: Boolean(id.hideUnavail),
  cmd,
  respond: 'update',
 });
};

export const renderGuide = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 if (!schema.guide) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const t = await this.t(cmd.guild_id);
 const actionState = await guideActionState.call(this, {
  guide: schema.guide,
  row,
  plugin: resolved.plugin,
  guildId: cmd.guild_id,
 });
 const page = buildGuidePage({
  settingName: id.settingName,
  schema,
  guide: schema.guide,
  rowId: id.rowId,
  row,
  originGroupId: id.groupId,
  sectionId: id.guideSection,
  guideFlags: id.guideFlags ?? 0,
  actionState,
  t,
 });

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings guide' })
  .setComponents(page.map((c) => c.toJSON() as APIMessageTopLevelComponent))
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
};
