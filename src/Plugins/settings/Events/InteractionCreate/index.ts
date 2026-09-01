import {
 InteractionType,
 MessageFlags,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIInteraction,
 type APIMessageComponentInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIModalSubmitInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import { settingsCommandName } from '../../../../Util/buildCommandBody.js';
import type SettingsPlugin from '../../Plugin.js';
import { hasManageGuild } from '../../Util/authorizeSettings.js';
import { parseSettingsId, SettingsAction, type SettingsId } from '../../Util/customId.js';

import autocomplete from './autocomplete.js';
import create from './create.js';
import fieldModal from './fieldModal.js';
import fieldSave from './fieldSave.js';
import groupNav from './groupNav.js';
import guideStep from './guideStep.js';
import { openFromCommand, reRender } from './navigator.js';
import { confirmDelete, del } from './rowActions.js';
import setField from './setField.js';
import toggleField from './toggleField.js';
import toggleUnavail from './toggleUnavail.js';

type ComponentHandler = (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) => unknown;

const componentHandlers: Partial<Record<SettingsAction, ComponentHandler>> = {
 [SettingsAction.GroupNav]: groupNav,
 [SettingsAction.SetField](this: SettingsPlugin, cmd, id) {
  return setField.call(this, cmd as APIMessageComponentSelectMenuInteraction, id);
 },
 [SettingsAction.ToggleField]: toggleField,
 [SettingsAction.FieldModal]: fieldModal,
 [SettingsAction.ToggleUnavail]: toggleUnavail,
 [SettingsAction.Nav]: reRender,
 [SettingsAction.Guide]: reRender,
 [SettingsAction.Create]: create,
 [SettingsAction.Delete]: confirmDelete,
 [SettingsAction.DeleteConfirm]: del,
 [SettingsAction.GuideStep]: guideStep,
};

const authorize = async function (this: SettingsPlugin, cmd: APIInteraction): Promise<boolean> {
 if (!cmd.guild_id) return false;
 if (hasManageGuild(cmd.member?.permissions)) return true;

 const t = await this.t(cmd.guild_id);
 new MessagePayload(this.client, { origin: this.name, reason: 'Settings permission check' })
  .setContent(t.navigator.manageGuildRequired())
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
 return false;
};

export default async function (
 this: SettingsPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand: {
   const command = cmd as APIApplicationCommandInteraction;
   if (command.data.name !== settingsCommandName) return;
   if (!(await authorize.call(this, command))) return;
   openFromCommand.call(this, command);
   break;
  }
  case InteractionType.ApplicationCommandAutocomplete:
   autocomplete.call(this, cmd as APIApplicationCommandAutocompleteInteraction);
   break;
  case InteractionType.MessageComponent: {
   const component = cmd as APIMessageComponentInteraction;
   const id = parseSettingsId(component.data.custom_id);
   if (!id) return;
   if (!(await authorize.call(this, component))) return;

   componentHandlers[id.action]?.call(this, component, id);
   break;
  }
  case InteractionType.ModalSubmit: {
   const modal = cmd as APIModalSubmitInteraction;
   const id = parseSettingsId(modal.data.custom_id);
   if (!id) return;
   if (!(await authorize.call(this, modal))) return;

   if (id.action === SettingsAction.FieldSave) fieldSave.call(this, modal, id);
   break;
  }
  default:
   break;
 }
}
