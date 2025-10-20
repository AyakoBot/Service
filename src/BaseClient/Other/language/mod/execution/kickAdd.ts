import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution.kickAdd,
 dm: (options: CT.ModOptions<CT.ModTypes.KickAdd>) =>
  t.stp(t.JSON.mod.execution.kickAdd.dm, {
   guild: t.languageFunction.getGuild(options.guild),
  }),
 alreadyApplied: (target: RUser) =>
  t.stp(t.JSON.mod.execution.kickAdd.alreadyApplied, {
   target: t.languageFunction.getUser(target),
  }),
 success: (target: RUser) =>
  t.stp(t.JSON.mod.execution.kickAdd.success, {
   target: t.languageFunction.getUser(target),
  }),
});
