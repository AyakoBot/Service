import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.logs.roleRemove,
 description: (target: RUser, executor: RUser, options: CT.ModOptions<CT.ModTypes.RoleRemove>) =>
  t.stp(t.JSON.mod.logs.roleRemove.description, {
   roles: options.roles.map((r) => t.languageFunction.getRole(r)),
   wasWere: options.roles.length > 1 ? t.JSON.mod.logs.roleAdd.were : t.JSON.mod.logs.roleAdd.was,
   target: t.languageFunction.getUser(target),
   executor: t.languageFunction.getUser(executor),
  }),
});
