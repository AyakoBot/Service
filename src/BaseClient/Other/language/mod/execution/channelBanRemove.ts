import * as Discord from 'discord.js';
import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution.channelBanRemove,
 dm: (options: CT.ModOptions<CT.ModTypes.ChannelBanRemove>) =>
  t.stp(t.JSON.mod.execution.channelBanRemove.dm, {
   channel: t.languageFunction.getChannel(options.channel),
  }),
 alreadyApplied: (target: RUser) =>
  t.stp(t.JSON.mod.execution.channelBanRemove.alreadyApplied, {
   target: t.languageFunction.getUser(target),
  }),
 success: (target: RUser) =>
  t.stp(t.JSON.mod.execution.channelBanRemove.success, {
   target: t.languageFunction.getUser(target),
  }),
});
