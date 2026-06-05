import {
    InteractionType,
    MessageFlags,
    type APIApplicationCommandAutocompleteInteraction,
    type APIApplicationCommandInteraction,
    type APIInteraction,
    type APIMessageComponentInteraction,
    type APIModalSubmitInteraction,
    type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import type SettingsPlugin from '../../Plugin.js';
import { hasManageGuild } from '../../Util/authorizeSettings.js';
import { parseSettingsId, SettingsAction } from '../../Util/customId.js';

import autocomplete from './autocomplete.js';
import create from './create.js';
import group from './group.js';
import { openFromCommand, reRender } from './navigator.js';
import { del, pause } from './rowActions.js';
import save from './save.js';

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
   if (command.data.name !== 'settings') return;
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

   if (id.action === SettingsAction.Group) group.call(this, component, id);
   if (id.action === SettingsAction.Nav || id.action === SettingsAction.SysSelect) {
    reRender.call(this, component, id);
   }
   if (id.action === SettingsAction.Create) create.call(this, component, id);
   if (id.action === SettingsAction.Pause) pause.call(this, component, id);
   if (id.action === SettingsAction.Delete) del.call(this, component, id);
   break;
  }
  case InteractionType.ModalSubmit: {
   const modal = cmd as APIModalSubmitInteraction;
   const id = parseSettingsId(modal.data.custom_id);
   if (!id) return;
   if (!(await authorize.call(this, modal))) return;

   if (id.action === SettingsAction.Save) save.call(this, modal, id);
   break;
  }
  default:
   break;
 }
}
