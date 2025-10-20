import * as CT from '../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.slashCommands.vc,
 helpEmbed: {
  ...t.JSON.slashCommands.vc.helpEmbed,
  help: (cmdId: string) => t.stp(t.JSON.slashCommands.vc.helpEmbed.help, { cmdId }),
 },
 addedMember: async (m: RMember, c: RChannel, cmdId: string) =>
  t.stp(t.JSON.slashCommands.vc.addedMember, {
   member: t.languageFunction.getUser(await t.cache.users.get(m.user_id)),
   channel: t.languageFunction.getChannel(c, t.channelTypes[c.type]),
   cmdId,
  }),
 removedMember: async (m: RMember, c: RChannel, cmdId: string) =>
  t.stp(t.JSON.slashCommands.vc.removedMember, {
   member: t.languageFunction.getUser(await t.cache.users.get(m.user_id)),
   channel: t.languageFunction.getChannel(c, t.channelTypes[c.type]),
   cmdId,
  }),
 addedManager: async (m: RMember, c: RChannel, cmdId: string) =>
  t.stp(t.JSON.slashCommands.vc.addedManager, {
   member: t.languageFunction.getUser(await t.cache.users.get(m.user_id)),
   channel: t.languageFunction.getChannel(c, t.channelTypes[c.type]),
   cmdId,
  }),
 removedManager: async (m: RMember, c: RChannel, cmdId: string) =>
  t.stp(t.JSON.slashCommands.vc.removedManager, {
   member: t.languageFunction.getUser(await t.cache.users.get(m.user_id)),
   channel: t.languageFunction.getChannel(c, t.channelTypes[c.type]),
   cmdId,
  }),
 reason: (user: string) => t.stp(t.JSON.slashCommands.vc.reason, { user }),
 removedAll: (channel: RChannel) => t.stp(t.JSON.slashCommands.vc.removedAll, { channel }),
 removedAllManagers: (channel: RChannel) =>
  t.stp(t.JSON.slashCommands.vc.removedAllManagers, { channel }),
 removedAllMembers: (channel: RChannel) =>
  t.stp(t.JSON.slashCommands.vc.removedAllMembers, { channel }),
 created: (channel: RChannel) => t.stp(t.JSON.slashCommands.vc.created, { channel }),
});
