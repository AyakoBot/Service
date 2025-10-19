import * as CT from '../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 rewards: {
  ...t.JSON.events.guildMemberUpdate.rewards,
  desc: (r: string[]) =>
   t.stp(t.JSON.events.guildMemberUpdate.rewards.desc, {
    roles: r.map((r2) => `<@&${r2}>`).join(', '),
   }),
  customRole: (commandId: string) =>
   t.stp(t.JSON.events.guildMemberUpdate.rewards.customRole, {
    commandId,
   }),
  xp: (amount: number) =>
   t.stp(t.JSON.events.guildMemberUpdate.rewards.xp, {
    amount,
   }),
  currency: (amount: number) =>
   t.stp(t.JSON.events.guildMemberUpdate.rewards.currency, {
    amount,
    emote: t.util.constants.standard.getEmote(t.util.emotes.book),
   }),
 },
});
