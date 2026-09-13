import { RequestHandlerError } from '@ayako/api';

import { CustomRolesReason, origin } from '../../constants.js';
import type CustomRolesPlugin from '../../Plugin.js';
import {
 grantRole,
 openSurface,
 reassertAnchor,
 refuse,
 requireRole,
 succeed,
 type CustomRoleInteraction,
} from '../../Util/surface.js';

import { roleName } from './create.js';

export const editName = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
 raw: string,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;

 const row = await requireRole.call(this, cmd, surface);
 if (!row) return;

 const edited = await surface.api.guilds.editRole(
  guildId,
  row.role,
  { name: await roleName.call(this, cmd, surface, raw) },
  { origin, reason: CustomRolesReason.Manage },
 );

 if (edited instanceof RequestHandlerError) {
  this.nonFatalError(edited, 'customRoles.editName');
  await refuse.call(this, cmd, surface, surface.t.base.errors.unknownError());
  return;
 }

 grantRole.call(this, surface, row.role);

 const notes = await reassertAnchor.call(this, surface, row.role);
 await succeed.call(
  this,
  cmd,
  surface,
  surface.t.customRole.edit({ role: `<@&${row.role}>` }),
  notes,
 );
};
