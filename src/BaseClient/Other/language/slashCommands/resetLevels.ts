import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.slashCommands.resetLevels,
 areYouSure: (time: string) => t.stp(t.JSON.slashCommands.resetLevels.areYouSure, { t: time }),
 confirmUser: (user: RUser) =>
  t.stp(t.JSON.slashCommands.resetLevels.confirmUser, { user: t.languageFunction.getUser(user) }),
 confirmRole: (role: RRole, amount: number) =>
  t.stp(t.JSON.slashCommands.resetLevels.confirmRole, {
   role: t.languageFunction.getRole(role),
   amount: t.util.splitByThousand(amount),
  }),
 user: (user: RUser) =>
  t.stp(t.JSON.slashCommands.resetLevels.user, { user: t.languageFunction.getUser(user) }),
 role: (role: RRole, amount: number) =>
  t.stp(t.JSON.slashCommands.resetLevels.role, {
   role: t.languageFunction.getRole(role),
   amount: t.util.splitByThousand(amount),
  }),
});
