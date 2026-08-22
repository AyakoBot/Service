import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 InteractionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type SettingsPlugin from '../Plugin.js';

import { parseSettingsId } from './customId.js';

const commandSettingName = (
 cmd: APIApplicationCommandInteraction | APIApplicationCommandAutocompleteInteraction,
): string | undefined => {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return undefined;

 const top = cmd.data.options?.[0];
 if (!top) return undefined;
 if (top.type === ApplicationCommandOptionType.SubcommandGroup) return top.options?.[0]?.name;
 if (top.type === ApplicationCommandOptionType.Subcommand) return top.name;
 return undefined;
};

export const targetSettingName = (cmd: APIInteraction): string | undefined => {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   return commandSettingName(cmd as APIApplicationCommandInteraction);
  case InteractionType.ApplicationCommandAutocomplete:
   return commandSettingName(cmd as APIApplicationCommandAutocompleteInteraction);
  case InteractionType.MessageComponent:
   return parseSettingsId((cmd as APIMessageComponentInteraction).data.custom_id)?.settingName;
  case InteractionType.ModalSubmit:
   return parseSettingsId((cmd as APIModalSubmitInteraction).data.custom_id)?.settingName;
  default:
   return undefined;
 }
};

export default function (this: SettingsPlugin, cmd: APIInteraction): boolean {
 const isDebug = !cmd.guild_id
  ? this.client.debugUsers.includes(cmd.user?.id || '')
  : this.client.debugGuilds.includes(cmd.guild_id);
 if (isDebug) return true;

 const settingName = targetSettingName(cmd);
 if (!settingName) return false;

 const plugin = this.client.plugins.find((p) => p.settingName === settingName);
 if (!plugin) return false;

 return this.client.cutoverFeatures.includes(plugin.name);
}
