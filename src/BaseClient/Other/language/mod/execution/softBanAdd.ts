import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution.softBanAdd,
 dm: (options: CT.ModOptions<CT.ModTypes.SoftBanAdd>) =>
  t.stp(t.JSON.mod.execution.softBanAdd.dm, {
   guild: t.languageFunction.getGuild(options.guild),
  }),
 alreadyApplied: (target: RUser) =>
  t.stp(t.JSON.mod.execution.softBanAdd.alreadyApplied, {
   target: t.languageFunction.getUser(target),
  }),
 success: (target: RUser) =>
  t.stp(t.JSON.mod.execution.softBanAdd.success, {
   target: t.languageFunction.getUser(target),
  }),
});
