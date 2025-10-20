import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution.unAfk,
 dm: () => t.JSON.mod.execution.unAfk.dm,
 alreadyApplied: (target: RUser) =>
  t.stp(t.JSON.mod.execution.unAfk.alreadyApplied, {
   target: t.languageFunction.getUser(target),
  }),
 success: (target: RUser) =>
  t.stp(t.JSON.mod.execution.unAfk.success, {
   target: t.languageFunction.getUser(target),
  }),
});
