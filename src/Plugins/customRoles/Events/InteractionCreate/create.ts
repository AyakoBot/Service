import { RequestHandlerError } from '@ayako/api';
import { RoleColorStyle } from '@ayako/database';
import { RESTJSONErrorCodes } from 'discord-api-types/v10';

import { getCensoredContent } from '../../../../Util/censorContent.js';
import { guildRoleLimit } from '../../../../Util/roleConstants.js';
import { isErrorCode } from '../../../moderation/Util/sentinel.js';
import { ROLE_NAME_LIMIT } from '../../Classes/Commands.js';
import { CustomRolesReason, origin } from '../../constants.js';
import type CustomRolesPlugin from '../../Plugin.js';
import {
 editNamePath,
 grantRole,
 openSurface,
 reassertAnchor,
 refuse,
 requireRole,
 succeed,
 type CustomRoleInteraction,
 type CustomRoleSurface,
} from '../../Util/surface.js';

export const roleName = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 raw: string,
): Promise<string> {
 if (!raw) return surface.displayName.slice(0, ROLE_NAME_LIMIT);

 const censored = await getCensoredContent.call(
  this,
  surface.guildId,
  raw,
  cmd.channel?.id ?? '',
  surface.roleIds,
 );

 return censored.slice(0, ROLE_NAME_LIMIT);
};

const claimRow = async function (
 this: CustomRolesPlugin,
 surface: CustomRoleSurface,
 roleId: string,
 stale: boolean,
): Promise<void> {
 if (!stale) {
  await this.client.db.client.customRole.create({
   data: { guild: surface.guildId, user: surface.userId, role: roleId },
  });
  return;
 }

 await this.client.db.client.customRole.updateMany({
  where: { guild: surface.guildId, user: surface.userId },
  data: {
   role: roleId,
   style: RoleColorStyle.solid,
   primaryColor: null,
   secondaryColor: null,
   tertiaryColor: null,
  },
 });
};

export const create = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
 raw: string,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;

 const stale = await this.roles.rowFor(guildId, surface.userId);
 const existing = stale ? await this.client.cache.roles.get(stale.role) : null;

 if (stale && existing) {
  await refuse.call(
   this,
   cmd,
   surface,
   surface.t.customRole.alreadyExists({ command: surface.mention(editNamePath) }),
  );
  return;
 }

 const roles = await this.client.cache.roles.getAll(guildId);
 if (roles.length >= guildRoleLimit) {
  await refuse.call(this, cmd, surface, surface.t.errors.roleCapReached());
  return;
 }

 const created = await surface.api.guilds.createRole(
  guildId,
  { name: await roleName.call(this, cmd, surface, raw), permissions: '0' },
  { origin, reason: CustomRolesReason.Grant },
 );

 if (created instanceof RequestHandlerError) {
  this.nonFatalError(created, 'customRoles.create');
  const capped = isErrorCode(created, RESTJSONErrorCodes.MaximumNumberOfGuildRolesReached);

  await refuse.call(
   this,
   cmd,
   surface,
   capped ? surface.t.errors.roleCapReached() : surface.t.base.errors.unknownError(),
  );
  return;
 }

 await this.client.cache.roles.set(created, guildId);
 await claimRow.call(this, surface, created.id, !!stale);
 grantRole.call(this, surface, created.id);

 const notes = await reassertAnchor.call(this, surface, created.id);
 await succeed.call(
  this,
  cmd,
  surface,
  surface.t.customRole.create({ role: `<@&${created.id}>` }),
  notes,
 );
};

export const del = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;

 const row = await requireRole.call(this, cmd, surface);
 if (!row) return;

 const role = await this.client.cache.roles.get(row.role);
 if (!(await this.roles.revoke(guildId, surface.userId, CustomRolesReason.Manage))) {
  await refuse.call(this, cmd, surface, surface.t.base.errors.unknownError());
  return;
 }

 await succeed.call(
  this,
  cmd,
  surface,
  surface.t.customRole.deleted({ role: role?.name ?? row.role }),
 );
};
