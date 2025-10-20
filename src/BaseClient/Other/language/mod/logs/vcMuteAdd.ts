import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.logs.vcMuteAdd,
 description: (target: RUser, executor: RUser) =>
  t.stp(t.JSON.mod.logs.vcMuteAdd.description, {
   target: t.languageFunction.getUser(target),
   executor: t.languageFunction.getUser(executor),
  }),
});
