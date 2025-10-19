import * as CT from '../../../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.events.logs.channel,
 descCreateAudit: (user: RUser, channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descCreateAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descCreate: (channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descCreate, {
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descDeleteAudit: (user: RUser, channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descDeleteAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descDelete: (channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descDelete, {
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descUpdateAudit: (user: RUser, channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descUpdateAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descUpdate: (channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descUpdate, {
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descJoinMember: (thread: RThread, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descJoinMember, {
   channel: t.languageFunction.getChannel(thread, channelType),
  }),
 descLeaveMember: (thread: RThread, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descLeaveMember, {
   channel: t.languageFunction.getChannel(thread, channelType),
  }),
 descUpdateStageAudit: (channel: RChannel, channelType: string, user: RUser) =>
  t.stp(t.JSON.events.logs.channel.descUpdateStageAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descUpdateStage: (channel: RChannel, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descUpdateStage, {
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descCreateStageAudit: (channel: RChannel, channelType: string, user: RUser) =>
  t.stp(t.JSON.events.logs.channel.descCreateStageAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descCreateStage: (channel: RChannel, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descCreateStage, {
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descDeleteStageAudit: (channel: RChannel, channelType: string, user: RUser) =>
  t.stp(t.JSON.events.logs.channel.descDeleteStageAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descDeleteStage: (channel: RChannel, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descDeleteStage, {
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descPinCreateAudit: async (user: RUser, msg: RMessage, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descPinCreateAudit, {
   user: t.languageFunction.getUser(user),
   msg: t.languageFunction.getMessage(msg),
   channel: t.languageFunction.getChannel(await t.cache.channels.get(msg.channel_id), channelType),
  }),
 descPinCreate: async (msg: RMessage, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descPinCreate, {
   msg: t.languageFunction.getMessage(msg),
   channel: t.languageFunction.getChannel(await t.cache.channels.get(msg.channel_id), channelType),
  }),
 descPinRemoveAudit: async (user: RUser, msg: RMessage, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descPinRemoveAudit, {
   user: t.languageFunction.getUser(user),
   msg: t.languageFunction.getMessage(msg),
   channel: t.languageFunction.getChannel(await t.cache.channels.get(msg.channel_id), channelType),
  }),
 descPinRemove: async (msg: RMessage, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descPinRemove, {
   msg: t.languageFunction.getMessage(msg),
   channel: t.languageFunction.getChannel(await t.cache.channels.get(msg.channel_id), channelType),
  }),
 descTyping: (user: RUser, channel: RChannel, channelType: string) =>
  t.stp(t.JSON.events.logs.channel.descTyping, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, channelType),
  }),
 descStatusUpdate: (channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descDelete, {
   channel: t.languageFunction.getChannel(channel, type),
  }),
 descStatusUpdateAudit: (user: RUser, channel: RChannel | RThread, type: string) =>
  t.stp(t.JSON.events.logs.channel.descStatusUpdateAudit, {
   user: t.languageFunction.getUser(user),
   channel: t.languageFunction.getChannel(channel, type),
  }),
 privacyLevel: {
  1: t.JSON.events.logs.channel.privacyLevel[1],
  2: t.JSON.events.logs.channel.privacyLevel[2],
 },
 videoQualityMode: {
  1: t.JSON.events.logs.channel.videoQualityMode[1],
  2: t.JSON.events.logs.channel.videoQualityMode[2],
 },
});
