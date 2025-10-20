import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution.vcMuteRemove,
 dm: () => t.JSON.mod.execution.vcMuteRemove.dm,
 alreadyApplied: (target: RUser) =>
  t.stp(t.JSON.mod.execution.vcMuteRemove.alreadyApplied, {
   target: t.languageFunction.getUser(target),
  }),
 success: (target: RUser) =>
  t.stp(t.JSON.mod.execution.vcMuteRemove.success, {
   target: t.languageFunction.getUser(target),
  }),
});
