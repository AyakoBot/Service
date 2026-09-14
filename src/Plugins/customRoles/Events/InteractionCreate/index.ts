import type { GatewayDispatchEvents } from '@discordjs/core';
import {
 ApplicationCommandType,
 ComponentType,
 InteractionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import {
 getStringOption,
 getSubcommand,
 getSubcommandGroup,
} from '../../../../Util/interactionOptions.js';
import {
 CustomRoleCommand,
 CustomRoleGroup,
 CustomRoleOption,
 CustomRoleSubcommand,
} from '../../Classes/Commands.js';
import { CustomRolesRoute } from '../../Classes/Routes.js';
import type CustomRolesPlugin from '../../Plugin.js';

import { create, del } from './create.js';
import { editColor } from './editColor.js';
import { editIcon, iconSave } from './editIcon.js';
import { editName } from './editName.js';
import { autocomplete, claimShared, shareRefresh, shareSelect, sharePanel } from './share.js';

const command = async function (
 this: CustomRolesPlugin,
 cmd: APIApplicationCommandInteraction,
): Promise<void> {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 const chatCmd = cmd as APIChatInputApplicationCommandInteraction;
 if (chatCmd.data.name !== CustomRoleCommand.CustomRole) return;
 if (!chatCmd.guild_id) return;

 const group = getSubcommandGroup(chatCmd);
 if (group) {
  const leaf = group.options?.[0];
  if (group.name === CustomRoleGroup.EditColor && leaf) {
   await editColor.call(this, chatCmd, chatCmd.guild_id, leaf);
  }
  return;
 }

 const sub = getSubcommand(chatCmd);
 if (!sub) return;

 switch (sub.name as CustomRoleSubcommand) {
  case CustomRoleSubcommand.Create:
   await create.call(this, chatCmd, chatCmd.guild_id, getStringOption(sub, CustomRoleOption.Name));
   break;
  case CustomRoleSubcommand.Delete:
   await del.call(this, chatCmd, chatCmd.guild_id);
   break;
  case CustomRoleSubcommand.EditName:
   await editName.call(
    this,
    chatCmd,
    chatCmd.guild_id,
    getStringOption(sub, CustomRoleOption.Name),
   );
   break;
  case CustomRoleSubcommand.EditIcon:
   await editIcon.call(this, chatCmd, chatCmd.guild_id, sub);
   break;
  case CustomRoleSubcommand.Share:
   await sharePanel.call(this, chatCmd, chatCmd.guild_id);
   break;
  case CustomRoleSubcommand.ClaimShared:
   await claimShared.call(this, chatCmd, sub);
   break;
  default:
   break;
 }
};

const component = async function (
 this: CustomRolesPlugin,
 cmd: APIMessageComponentInteraction,
): Promise<void> {
 const [route, ...args] = cmd.data.custom_id.split('_');

 switch (route) {
  case CustomRolesRoute.Share:
   if (cmd.data.component_type === ComponentType.UserSelect) {
    await shareSelect.call(this, cmd, cmd.data.values);
   }
   break;
  case CustomRolesRoute.ShareRefresh:
   await shareRefresh.call(this, cmd);
   break;
  case CustomRolesRoute.RewardNotify: {
   const guildId = args[0] || cmd.guild_id;
   if (guildId) await create.call(this, cmd, guildId, '');
   break;
  }
  default:
   break;
 }
};

const modal = async function (
 this: CustomRolesPlugin,
 cmd: APIModalSubmitInteraction,
): Promise<void> {
 const [route] = cmd.data.custom_id.split('_');
 if (route !== CustomRolesRoute.IconModal || !cmd.guild_id) return;

 await iconSave.call(this, cmd, cmd.guild_id);
};

export default async function (
 this: CustomRolesPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
): Promise<void> {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   await command.call(this, cmd);
   break;
  case InteractionType.ApplicationCommandAutocomplete:
   await autocomplete.call(this, cmd as APIApplicationCommandAutocompleteInteraction);
   break;
  case InteractionType.MessageComponent:
   await component.call(this, cmd as APIMessageComponentInteraction);
   break;
  case InteractionType.ModalSubmit:
   await modal.call(this, cmd as APIModalSubmitInteraction);
   break;
  default:
   break;
 }
}
