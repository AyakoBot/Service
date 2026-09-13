import { RequestHandlerError } from '@ayako/api';
import { RoleColorStyle } from '@ayako/database';
import { GuildFeature } from '@discordjs/core';
import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIRoleColors,
} from 'discord-api-types/v10';

import { getRoleOption, getStringOption } from '../../../../Util/interactionOptions.js';
import { parseColor } from '../../../../Util/parseColor.js';
import { HolographicPreset } from '../../../../Util/roleConstants.js';
import { CustomRoleColorSubcommand, CustomRoleOption } from '../../Classes/Commands.js';
import { CustomRolesReason, origin } from '../../constants.js';
import type CustomRolesPlugin from '../../Plugin.js';
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

enum ColorSample {
 Invalid = 'invalid',
}

type Sampled = number | ColorSample.Invalid | null;

interface ColorPair {
 primary: number | null;
 secondary: number | null;
}

const sampleOne = async function (
 this: CustomRolesPlugin,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 colorOption: CustomRoleOption,
 roleOption: CustomRoleOption,
): Promise<Sampled> {
 const roleId = getRoleOption(sub, roleOption);
 if (roleId) {
  const role = await this.client.cache.roles.get(roleId);
  return role ? (role.colors?.primary_color ?? role.color) : ColorSample.Invalid;
 }

 const raw = getStringOption(sub, colorOption);
 if (!raw) return null;

 return parseColor(raw) ?? ColorSample.Invalid;
};

const samplePair = async function (
 this: CustomRolesPlugin,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
): Promise<ColorPair | null> {
 const [primary, secondary] = await Promise.all([
  sampleOne.call(this, sub, CustomRoleOption.Color, CustomRoleOption.ColorRole),
  sampleOne.call(this, sub, CustomRoleOption.ColorTwo, CustomRoleOption.ColorRoleTwo),
 ]);

 if (primary === ColorSample.Invalid || secondary === ColorSample.Invalid) return null;

 return { primary, secondary };
};

const applyColors = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 roleId: string,
 style: RoleColorStyle,
 colors: APIRoleColors,
): Promise<void> {
 const edited = await surface.api.guilds.editRole(
  surface.guildId,
  roleId,
  { colors },
  { origin, reason: CustomRolesReason.Manage },
 );

 if (edited instanceof RequestHandlerError) {
  this.nonFatalError(edited, 'customRoles.editColor');
  await refuse.call(this, cmd, surface, surface.t.base.errors.unknownError());
  return;
 }

 await this.client.db.client.customRole.updateMany({
  where: { guild: surface.guildId, user: surface.userId },
  data: {
   style,
   primaryColor: colors.primary_color,
   secondaryColor: colors.secondary_color ?? null,
   tertiaryColor: colors.tertiary_color ?? null,
  },
 });

 grantRole.call(this, surface, roleId);

 const notes = await reassertAnchor.call(this, surface, roleId);
 await succeed.call(this, cmd, surface, surface.t.customRole.edit({ role: `<@&${roleId}>` }), notes);
};

const solid = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 roleId: string,
 pair: ColorPair,
): Promise<void> {
 if (!surface.capabilities.canSetColor) {
  await refuse.call(this, cmd, surface, surface.t.customRole.cantSetColor());
  return;
 }

 if (pair.primary === null) {
  await refuse.call(this, cmd, surface, surface.t.base.errors.noArguments());
  return;
 }

 await applyColors.call(this, cmd, surface, roleId, RoleColorStyle.solid, {
  primary_color: pair.primary,
  secondary_color: null,
  tertiary_color: null,
 });
};

const gradient = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 roleId: string,
 pair: ColorPair,
): Promise<void> {
 if (!(await hasFeature.call(this, surface.guildId, GuildFeature.EnhancedRoleColors))) {
  await refuse.call(this, cmd, surface, surface.t.errors.gradientsNotAvailable());
  return;
 }

 if (!surface.capabilities.canSetGradient) {
  await refuse.call(this, cmd, surface, surface.t.customRole.cantSetGradient());
  return;
 }

 if (pair.primary === null || pair.secondary === null) {
  await refuse.call(this, cmd, surface, surface.t.customRole.gradientNeedsTwo());
  return;
 }

 await applyColors.call(this, cmd, surface, roleId, RoleColorStyle.gradient, {
  primary_color: pair.primary,
  secondary_color: pair.secondary,
  tertiary_color: null,
 });
};

const holographic = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 roleId: string,
): Promise<void> {
 if (!(await hasFeature.call(this, surface.guildId, GuildFeature.EnhancedRoleColors))) {
  await refuse.call(this, cmd, surface, surface.t.errors.holographicNotAvailable());
  return;
 }

 if (!surface.capabilities.canSetHolo) {
  await refuse.call(this, cmd, surface, surface.t.customRole.cantSetHolo());
  return;
 }

 await applyColors.call(this, cmd, surface, roleId, RoleColorStyle.holographic, {
  primary_color: HolographicPreset.primaryColor,
  secondary_color: HolographicPreset.secondaryColor,
  tertiary_color: HolographicPreset.tertiaryColor,
 });
};

export const editColor = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
 leaf: APIApplicationCommandInteractionDataSubcommandOption,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;

 const row = await requireRole.call(this, cmd, surface);
 if (!row) return;

 const style = leaf.name as CustomRoleColorSubcommand;
 if (style === CustomRoleColorSubcommand.Holographic) {
  await holographic.call(this, cmd, surface, row.role);
  return;
 }

 const pair = await samplePair.call(this, leaf);
 if (!pair) {
  await refuse.call(this, cmd, surface, surface.t.base.errors.invalidColor());
  return;
 }

 switch (style) {
  case CustomRoleColorSubcommand.Solid:
   await solid.call(this, cmd, surface, row.role, pair);
   break;
  case CustomRoleColorSubcommand.Gradient:
   await gradient.call(this, cmd, surface, row.role, pair);
   break;
  default:
   await refuse.call(this, cmd, surface, surface.t.base.errors.inputNoMatch());
 }
};
