import { RequestHandlerError } from '@ayako/api';
import {
 LabelBuilder,
 ModalBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import { GuildFeature } from '@discordjs/core';
import {
 ApplicationCommandOptionType,
 TextInputStyle,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIChatInputApplicationCommandInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { resolveRoleIconSource, RoleIconError } from '../../../../Util/roleIconSource.js';
import { CustomRoleModalField, CustomRoleOption } from '../../Classes/Commands.js';
import { CustomRolesRoute } from '../../Classes/Routes.js';
import { CustomRolesReason, origin } from '../../constants.js';
import type CustomRolesPlugin from '../../Plugin.js';
import type { CustomRolesTranslator } from '../../Plugin.js';
import {
 grantRole,
 hasFeature,
 openSurface,
 reassertAnchor,
 refuse,
 requireRole,
 succeed,
 type CustomRoleInteraction,
 type CustomRoleSurface,
} from '../../Util/surface.js';

interface IconInput {
 emoji?: string;
 attachmentUrl?: string;
 url?: string;
}

const iconErrorText: Record<RoleIconError, (t: CustomRolesTranslator) => string> = {
 [RoleIconError.NotDiscordCdn]: (t) => t.base.errors.notDiscordCdn(),
 [RoleIconError.FetchFailed]: (t) => t.base.errors.cantFetch(),
 [RoleIconError.NoInput]: (t) => t.errors.noIconInput(),
 [RoleIconError.FeatureMissing]: (t) => t.errors.iconsNotAvailable(),
};

const stringOf = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: CustomRoleOption,
): string | undefined => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.String ? option.value : undefined;
};

const attachmentUrlOf = (
 cmd: APIChatInputApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
): string | undefined => {
 const option = sub.options?.find((o) => o.name === CustomRoleOption.Icon);
 if (!option || option.type !== ApplicationCommandOptionType.Attachment) return undefined;

 return cmd.data.resolved?.attachments?.[option.value]?.url;
};

const iconGate = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
): Promise<boolean> {
 if (!(await hasFeature.call(this, surface.guildId, GuildFeature.RoleIcons))) {
  await refuse.call(this, cmd, surface, iconErrorText[RoleIconError.FeatureMissing](surface.t));
  return false;
 }

 if (!surface.capabilities.canSetIcon) {
  await refuse.call(this, cmd, surface, surface.t.customRole.cantSetIcon());
  return false;
 }

 return true;
};

const applyIcon = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 roleId: string,
 input: IconInput,
): Promise<void> {
 const source = await resolveRoleIconSource(input);
 if ('error' in source) {
  await refuse.call(this, cmd, surface, iconErrorText[source.error](surface.t));
  return;
 }

 const edited = await surface.api.guilds.editRole(
  surface.guildId,
  roleId,
  'unicodeEmoji' in source
   ? { unicode_emoji: source.unicodeEmoji, icon: null }
   : { icon: source.icon, unicode_emoji: null },
  { origin, reason: CustomRolesReason.Manage },
 );

 if (edited instanceof RequestHandlerError) {
  this.nonFatalError(edited, 'customRoles.editIcon');
  await refuse.call(this, cmd, surface, surface.t.base.errors.unknownError());
  return;
 }

 grantRole.call(this, surface, roleId);

 const notes = await reassertAnchor.call(this, surface, roleId);
 await succeed.call(this, cmd, surface, surface.t.customRole.edit({ role: `<@&${roleId}>` }), notes);
};

const openIconModal = async function (
 this: CustomRolesPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 surface: CustomRoleSurface,
): Promise<void> {
 const built = new ModalBuilder()
  .setCustomId(this.getRoute(CustomRolesRoute.IconModal))
  .setTitle(surface.t.customRole.iconModalTitle().slice(0, 45))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(surface.t.customRole.iconModalEmoji().slice(0, 45))
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(CustomRoleModalField.IconEmoji)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100),
    ),
   new LabelBuilder()
    .setLabel(surface.t.customRole.iconModalUrl().slice(0, 45))
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(CustomRoleModalField.IconUrl)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500),
    ),
  );

 surface.api.interactions.createModal(cmd.id, cmd.token, built.toJSON(), {
  origin,
  reason: 'Opening the Custom-Role icon modal',
 });
};

export const editIcon = async function (
 this: CustomRolesPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 guildId: string,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;
 if (!(await iconGate.call(this, cmd, surface))) return;

 const row = await requireRole.call(this, cmd, surface);
 if (!row) return;

 const input: IconInput = {
  emoji: stringOf(sub, CustomRoleOption.IconEmoji),
  attachmentUrl: attachmentUrlOf(cmd, sub),
  url: stringOf(sub, CustomRoleOption.IconUrl),
 };

 if (!input.emoji && !input.attachmentUrl && !input.url) {
  await openIconModal.call(this, cmd, surface);
  return;
 }

 await applyIcon.call(this, cmd, surface, row.role, input);
};

export const iconSave = async function (
 this: CustomRolesPlugin,
 cmd: APIModalSubmitInteraction,
 guildId: string,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;
 if (!(await iconGate.call(this, cmd, surface))) return;

 const row = await requireRole.call(this, cmd, surface);
 if (!row) return;

 await applyIcon.call(this, cmd, surface, row.role, {
  emoji: findModalValue(cmd.data.components, CustomRoleModalField.IconEmoji)?.trim(),
  url: findModalValue(cmd.data.components, CustomRoleModalField.IconUrl)?.trim(),
 });
};
