import { ActionRowBuilder, ButtonBuilder, ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import emotes from '../../../../Classes/Emotes.js';
import type SettingsPlugin from '../../Plugin.js';
import { encodeSettingsId, SettingsAction, type SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { buttonEmoji } from '../../Util/settingsEmotes.js';

import { reRender } from './navigator.js';

export const confirmDelete = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;
 if (!resolved.schema.multiRow) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const t = await this.t(cmd.guild_id);

 const guard = await resolved.schema.canDelete?.(row, {
  client: this.client,
  plugin: resolved.plugin,
  guildId: cmd.guild_id,
 });
 const blocked = Boolean(guard && !guard.ok);

 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${emotes.warning.name} ${t.navigator.deleteTitle({ label: schema.rowLabel(row) })}\n${
    blocked ? (guard?.reason ?? t.base.errors.unknownError()) : t.navigator.deleteWarning()
   }`,
  ),
 );

 const buttons: ButtonBuilder[] = [];
 if (!blocked) {
  buttons.push(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setLabel(t.navigator.confirmDelete())
    .setEmoji(buttonEmoji(emotes.trash))
    .setCustomId(
     encodeSettingsId({
      action: SettingsAction.DeleteConfirm,
      settingName: id.settingName,
      rowId: id.rowId,
     }),
    ),
  );
 }
 buttons.push(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.base.t.Cancel())
   .setEmoji(buttonEmoji(emotes.back))
   .setCustomId(
    encodeSettingsId({
     action: SettingsAction.Nav,
     settingName: id.settingName,
     rowId: id.rowId,
     groupId: id.groupId,
     hideUnavail: id.hideUnavail,
    }),
   ),
 );

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete confirmation' })
  .setComponents([
   container.toJSON() as APIMessageTopLevelComponent,
   new ActionRowBuilder<ButtonBuilder>()
    .addComponents(...buttons)
    .toJSON() as APIMessageTopLevelComponent,
  ])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
};

export const del = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;
 if (!resolved.schema.multiRow) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const t = await this.t(cmd.guild_id);

 const guard = await resolved.schema.canDelete?.(row, {
  client: this.client,
  plugin: resolved.plugin,
  guildId: cmd.guild_id,
 });

 if (guard && !guard.ok) {
  new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete blocked' })
   .setContent(guard.reason ?? t.base.errors.unknownError())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 const deleted = await this.tableClient(resolved.schema.table)
  .deleteMany({ where: { id: id.rowId, guild: cmd.guild_id } })
  .catch((error: Error) => error);

 if (deleted instanceof Error) {
  this.nonFatalError(deleted, 'settingsDelete');

  new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete failed' })
   .setContent(t.base.errors.unknownError())
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 reRender.call(this, cmd, { ...id, rowId: undefined });
};
