import { RequestHandlerError } from '@ayako/api';
import {
 ComponentType,
 MessageFlags,
 type APIModalSubmission,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type { UpdateData } from '../../../../Types/prisma.js';
import { EditorType } from '../../EditorType.js';
import type SettingsPlugin from '../../Plugin.js';
import { FieldArity, type SettingsField, type SettingsGroup } from '../../SettingsSchema.js';
import { buildGroupModal } from '../../Util/buildGroupModal.js';
import type { SettingsId } from '../../Util/customId.js';
import { findModalValue } from '../../Util/findModalValue.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { ComponentKind, resolveComponentKind } from '../../Util/resolveComponentKind.js';
import { resolveSchema } from '../../Util/resolveSchema.js';

import { reRender } from './navigator.js';

type SubmitComponent = APIModalSubmission['components'][number];
type InnerComponent = Extract<SubmitComponent, { type: ComponentType.Label }>['component'];

const flatten = (components: readonly SubmitComponent[]): InnerComponent[] =>
 components.flatMap<InnerComponent>((c) => {
  if (c.type === ComponentType.Label) return [c.component];
  if (c.type === ComponentType.ActionRow) return c.components;
  return [];
 });

const findSubmitComponent = (
 components: readonly SubmitComponent[],
 customId: string,
): InnerComponent | undefined =>
 flatten(components).find((c) => 'custom_id' in c && c.custom_id === customId);

const readCheckbox = (
 components: readonly SubmitComponent[],
 customId: string,
): boolean | undefined => {
 const comp = findSubmitComponent(components, customId);
 if (comp && comp.type === ComponentType.Checkbox) return comp.value;
 return undefined;
};

const readRadio = (
 components: readonly SubmitComponent[],
 customId: string,
): string | undefined => {
 const comp = findSubmitComponent(components, customId);
 if (comp && comp.type === ComponentType.RadioGroup) return comp.value ?? undefined;
 return undefined;
};

const readField = (cmd: APIModalSubmitInteraction, field: SettingsField): unknown => {
 const optionCount = Array.isArray(field.options) ? field.options.length : 0;
 const kind = resolveComponentKind(field.editor, field.arity ?? FieldArity.Single, optionCount);
 const { components } = cmd.data;

 switch (kind) {
  case ComponentKind.CheckboxBool:
   return readCheckbox(components, field.column);
  case ComponentKind.Radio:
   return readRadio(components, field.column);
  case ComponentKind.TextMulti: {
   const raw = findModalValue(components, field.column);
   if (raw === undefined) return undefined;
   return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  }
  default: {
   const raw = findModalValue(components, field.column);
   if (raw === undefined) return undefined;
   if (field.editor === EditorType.Number) return raw === '' ? undefined : Number(raw);
   return raw;
  }
 }
};

const visibleFields = (group: SettingsGroup, row: Record<string, unknown>): SettingsField[] =>
 group.fields.filter((field) => (field.showIf ? field.showIf(row).ok : true));

export default async function (
 this: SettingsPlugin,
 cmd: APIModalSubmitInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.groupId) return;

 const resolved = resolveSchema(this.client, id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);

 const group = schema.groups.find((g) => g.id === id.groupId);
 if (!group) return;

 const row = (await this.client.db.client.ticketSetting.findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 })) as unknown as Record<string, unknown> | null;
 if (!row) return;

 const t = await this.t(cmd.guild_id);
 const fields = visibleFields(group, row);
 const data: Record<string, unknown> = {};

 for (const field of fields) {
  const value = readField(cmd, field);
  data[field.column] = value;

  const validation = field.validate?.(value, row);
  if (validation && !validation.ok) {
   const offending: SettingsField = {
    ...field,
    label: t.navigator.validationFailed({
     field: field.label,
     reason: validation.reason ?? '',
    }),
   };
   const patchedGroup: SettingsGroup = {
    ...group,
    fields: group.fields.map((f) => (f.column === field.column ? offending : f)),
   };
   const modal = buildGroupModal(id.settingName, schema, patchedGroup, id.rowId, row);
   const api = await this.client.getAPI(cmd.guild_id);
   await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
    origin: this.name,
    reason: 'Re-opening settings group after validation failure',
   });
   return;
  }
 }

 const merged = { ...row, ...data };
 if (merged.active === true) {
  const missing = fields.find(
   (field) =>
    field.required &&
    (merged[field.column] === undefined ||
     merged[field.column] === null ||
     merged[field.column] === ''),
  );

  if (missing) {
   new MessagePayload(this.client, { origin: this.name, reason: 'Settings required missing' })
    .setContent(t.navigator.requiredMissing({ field: missing.label }))
    .setFlags(MessageFlags.Ephemeral)
    .reply(cmd);
   return;
  }
 }

 await this.client.db.client.ticketSetting.updateMany({
  where: { id: id.rowId, guild: cmd.guild_id },
  data: data as UpdateData<'ticketSetting'>,
 });

 const confirm = await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Settings saved',
 })
  .setContent(t.navigator.saved())
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);

 if (confirm instanceof RequestHandlerError) {
  this.nonFatalError(new Error('Failed to confirm settings save', { cause: confirm }), 'save');
 }

 reRender.call(this, cmd, id);
}
