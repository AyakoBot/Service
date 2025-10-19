import * as CT from '../../../../../Typings/Typings.js';
import type { RAuditLog } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/auditlog.js';

export default (t: CT.Language) => ({
 ...t.JSON.events.logs.guild,
 descBan: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBan, {
   user: t.languageFunction.getUser(user),
  }),
 descBanAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBanAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descUnban: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descUnban, {
   user: t.languageFunction.getUser(user),
  }),
 descUnbanAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descUnbanAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descEmojiCreateAudit: (user: RUser, emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiCreateAudit, {
   user: t.languageFunction.getUser(user),
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descEmojiCreate: (emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiCreate, {
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descEmojiDeleteAudit: (user: RUser, emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiDeleteAudit, {
   user: t.languageFunction.getUser(user),
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descEmojiDelete: (emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiDelete, {
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descEmojiUpdateAudit: (user: RUser, emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiUpdateAudit, {
   user: t.languageFunction.getUser(user),
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descEmojiUpdate: (emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descEmojiUpdate, {
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descJoinAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descJoinAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descMemberJoin: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descMemberJoin, {
   user: t.languageFunction.getUser(user),
  }),
 descBotJoin: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBotJoin, {
   user: t.languageFunction.getUser(user),
  }),
 descBotLeave: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBotLeave, {
   user: t.languageFunction.getUser(user),
  }),
 descBotLeaveAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBotLeaveAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descMemberLeave: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descMemberLeave, {
   user: t.languageFunction.getUser(user),
  }),
 descMemberLeaveAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descMemberLeaveAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descBotUpdate: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBotUpdate, {
   user: t.languageFunction.getUser(user),
  }),
 descBotUpdateAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descBotUpdateAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descMemberUpdate: (user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descMemberUpdate, {
   user: t.languageFunction.getUser(user),
  }),
 descMemberUpdateAudit: (user: RUser, executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descMemberUpdateAudit, {
   executor: t.languageFunction.getUser(executor),
   user: t.languageFunction.getUser(user),
  }),
 descGuildUpdate: () => t.JSON.events.logs.guild.descGuildUpdate,
 descGuildUpdateAudit: (executor: RUser) =>
  t.stp(t.JSON.events.logs.guild.descGuildUpdateAudit, {
   executor: t.languageFunction.getUser(executor),
  }),
 descAuditLogCreate: async (audit: RAuditLog) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreate, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
  }),
 descAuditLogCreateGuild: async (audit: RAuditLog, guild: RGuild) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateGuild, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   guild: t.languageFunction.getGuild(guild),
  }),
 descAuditLogCreateChannel: async (audit: RAuditLog, channel: RChannel) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateChannel, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   channel: t.languageFunction.getChannel(channel),
  }),
 descAuditLogCreateUser: async (audit: RAuditLog, user: RUser) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateUser, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   user: t.languageFunction.getUser(user),
  }),
 descAuditLogCreateRole: async (audit: RAuditLog, role: RRole | { id: string; name: string }) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateRole, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   role: t.languageFunction.getRole(role),
  }),
 descAuditLogCreateInvite: async (audit: RAuditLog, invite: RInvite) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateInvite, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   invite: t.languageFunction.getInvite(invite),
  }),
 descAuditLogCreateWebhook: async (audit: RAuditLog, w: RWebhook) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateWebhook, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   webhook: t.languageFunction.getWebhook(w),
  }),
 descAuditLogCreateEmoji: async (audit: RAuditLog, emoji: REmoji) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateEmoji, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   emoji: t.languageFunction.getEmote(emoji),
  }),
 descAuditLogCreateMessage: async (audit: RAuditLog, message: RMessage) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateMessage, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   message: t.languageFunction.getMessage(message),
  }),
 descAuditLogCreateIntegration: async (audit: RAuditLog, integration: RIntegration) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateIntegration, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   integration: t.languageFunction.getIntegration(integration),
  }),
 descAuditLogCreateStageInstance: async (audit: RAuditLog, stageInstance: RStage) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateStageInstance, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   stageInstance: t.languageFunction.getStageInstance(stageInstance),
  }),
 descAuditLogCreateSticker: async (audit: RAuditLog, s: RSticker) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateSticker, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   sticker: t.languageFunction.getSticker(s),
  }),
 descAuditLogCreateThread: async (audit: RAuditLog, thread: RThread) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateThread, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   thread: t.languageFunction.getChannel(thread),
  }),
 descAuditLogCreateGuildScheduledEvent: async (audit: RAuditLog, s: REvent) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateGuildScheduledEvent, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   scheduledEvent: t.languageFunction.getScheduledEvent(s),
  }),
 descAuditLogCreateApplicationCommand: async (audit: RAuditLog, applicationCommand: RCommand) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateApplicationCommand, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   command: t.languageFunction.getCommand(applicationCommand),
  }),
 descAuditLogCreateAutoModerationRule: async (audit: RAuditLog, autoModerationRule: RAutomod) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateAutoModerationRule, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   autoModerationRule: t.languageFunction.getAutoModerationRule(autoModerationRule),
  }),
 descAuditLogCreateAutoModeration: async (audit: RAuditLog, member: RMember, rule: RAutomod) =>
  t.stp(t.JSON.events.logs.guild.descAuditLogCreateAutoModeration, {
   audit: t.languageFunction.getAuditLog(audit),
   executor: audit.user_id
    ? t.languageFunction.getUser(await t.cache.users.get(audit.user_id))
    : '',
   member: t.languageFunction.getUser(await t.cache.users.get(member.user_id)),
   autoModerationRule: t.languageFunction.getAutoModerationRule(rule),
  }),
 descMemberPrune: (executor: RUser, amount: number, days: number) =>
  t.stp(t.JSON.events.logs.guild.descMemberPrune, {
   executor: t.languageFunction.getUser(executor),
   amount: `${amount}`,
   days: `${days}`,
  }),
 welcomeChannelEmoji: (channel: RChannel) =>
  t.stp(t.JSON.events.logs.guild.welcomeChannelEmoji, {
   channel: t.languageFunction.getChannel(channel),
  }),
 defaultMessageNotifications: {
  0: t.JSON.events.logs.guild.defaultMessageNotifications[0],
  1: t.JSON.events.logs.guild.defaultMessageNotifications[1],
 },
 explicitContentFilter: {
  0: t.JSON.events.logs.guild.explicitContentFilter[0],
  1: t.JSON.events.logs.guild.explicitContentFilter[1],
  2: t.JSON.events.logs.guild.explicitContentFilter[2],
 },
 mfaLevel: {
  0: t.JSON.events.logs.guild.mfaLevel[0],
  1: t.JSON.events.logs.guild.mfaLevel[1],
 },
 nsfwLevel: {
  0: t.JSON.events.logs.guild.nsfwLevel[0],
  1: t.JSON.events.logs.guild.nsfwLevel[1],
  2: t.JSON.events.logs.guild.nsfwLevel[2],
  3: t.JSON.events.logs.guild.nsfwLevel[3],
 },
 verificationLevel: {
  0: t.JSON.events.logs.guild.verificationLevel[0],
  1: t.JSON.events.logs.guild.verificationLevel[1],
  2: t.JSON.events.logs.guild.verificationLevel[2],
  3: t.JSON.events.logs.guild.verificationLevel[3],
  4: t.JSON.events.logs.guild.verificationLevel[4],
 },
});
