import {
 LabelBuilder,
 ModalBuilder,
 RoleSelectMenuBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { TicketRoute } from '../../Classes/Routes.js';
import TicketRoleMap from '../../Classes/TicketRoleMap.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { findModalValue, findModalValues } from '../../Util/findModalValue.js';

import { buildRoleMapEditor, roleMapWarn } from './roleMap.js';

const resolveRoleName = async function (
 this: TicketPlugin,
 roleId: string,
): Promise<string | null> {
 const role = await this.client.cache.roles.get(roleId);
 return role?.name || null;
};

export const roleMapAdd = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.RoleMapSave))
  .setTitle(t.roleMap.addTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.base.t.Role())
    .setRoleSelectMenuComponent(
     new RoleSelectMenuBuilder().setCustomId('role').setMinValues(1).setMaxValues(1),
    ),
   new LabelBuilder()
    .setLabel(t.base.t.Label())
    .setDescription(t.roleMap.labelPrompt())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('label')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening role map add modal',
 });
};

export const roleMapEdit = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const index = Number(args[0]);
 const entries = await new TicketRoleMap(this.client, cmd.guild_id).list();
 const entry = entries[index];
 if (!entry) {
  roleMapWarn.call(this, cmd, (await this.t(cmd.guild_id)).roleMap.errors.notFound());
  return;
 }

 const t = await this.t(cmd.guild_id);
 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.RoleMapSave, index))
  .setTitle(t.roleMap.editTitle({ role: t.base.t.Role() }))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.base.t.Label())
    .setDescription(t.roleMap.labelPrompt())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('label')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100)
      .setValue(entry.label),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening role map edit modal',
 });
};

export const roleMapSave = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const map = new TicketRoleMap(this.client, cmd.guild_id);
 const rawLabel = (findModalValue(cmd.data.components, 'label') || '').trim();

 if (args.length) {
  const index = Number(args[0]);
  const entries = await map.list();
  const entry = entries[index];
  if (!entry) {
   roleMapWarn.call(this, cmd, t.roleMap.errors.notFound());
   return;
  }

  const label = rawLabel || (await resolveRoleName.call(this, entry.role)) || entry.label;
  const next = await map.editAt(index, label).catch((error: Error) => error);
  if (next instanceof Error) {
   this.nonFatalError(next, 'roleMapSave.edit');
   roleMapWarn.call(this, cmd, t.base.errors.unknownError());
   return;
  }

  const payload = await buildRoleMapEditor.call(this, cmd.guild_id, next, 0);
  payload.update(cmd);
  return;
 }

 const [role] = findModalValues(cmd.data.components, 'role');
 if (!role) {
  roleMapWarn.call(this, cmd, t.roleMap.errors.roleRequired());
  return;
 }

 const label = rawLabel || (await resolveRoleName.call(this, role)) || role;
 const next = await map.add(role, label).catch((error: Error) => error);
 if (next instanceof Error) {
  this.nonFatalError(next, 'roleMapSave.add');
  roleMapWarn.call(this, cmd, t.base.errors.unknownError());
  return;
 }

 const payload = await buildRoleMapEditor.call(this, cmd.guild_id, next, 0);
 payload.update(cmd);
};
