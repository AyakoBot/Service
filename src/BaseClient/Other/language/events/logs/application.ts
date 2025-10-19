import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.events.logs.application,
 descUpdateCommand: (application: RUser, user: RUser, command: RCommand | RGuildCommand) =>
  t.stp(t.JSON.events.logs.application.descUpdateCommand, {
   user: t.languageFunction.getUser(user),
   application: t.languageFunction.getUser(application),
   command: t.languageFunction.getCommand(command),
  }),
 descUpdateAll: (application: RUser, user: RUser) =>
  t.stp(t.JSON.events.logs.application.descUpdateAll, {
   user: t.languageFunction.getUser(user),
   application: t.languageFunction.getUser(application),
  }),
});
