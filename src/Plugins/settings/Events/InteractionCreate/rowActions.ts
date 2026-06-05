import { TicketState } from '@ayako/database';
import {
 MessageFlags,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import type { SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

import { reRender } from './navigator.js';

const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);

export const pause = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 if (!row.active) {
  const resolved = resolveSchema(this.client, id.settingName);
  if (!resolved) return;

  const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
  const rowData = row as unknown as Record<string, unknown>;
  const missing = schema.groups
   .flatMap((group) => group.fields)
   .find((field) => field.required && isUnset(rowData[field.column]));

  if (missing) {
   const t = await this.t(cmd.guild_id);
   new MessagePayload(this.client, { origin: this.name, reason: 'Settings activate blocked' })
    .setContent(t.navigator.activateBlocked({ field: missing.label }))
    .setFlags(MessageFlags.Ephemeral)
    .reply(cmd);
   return;
  }
 }

 await this.client.db.client.ticketSetting.updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: { active: !row.active },
 });

 reRender.call(this, cmd, id);
};

export const del = async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId) return;

 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const open = await this.client.db.client.ticket.findMany({
  where: {
   settingsId: id.rowId,
   state: { in: [TicketState.opened, TicketState.claimed] },
  },
 });

 if (open.length) {
  const t = await this.t(cmd.guild_id);
  new MessagePayload(this.client, { origin: this.name, reason: 'Settings delete blocked' })
   .setContent(t.navigator.deleteBlocked({ count: String(open.length) }))
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
  return;
 }

 await this.client.db.client.ticketSetting.deleteMany({
  where: { id: id.rowId, guild: cmd.guild_id },
 });

 reRender.call(this, cmd, { ...id, rowId: undefined });
};
