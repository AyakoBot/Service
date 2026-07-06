import type {
 RAuditLog,
 RAutomod,
 RChannel,
 RCommand,
 REmoji,
 REvent,
 RGuild,
 RGuildCommand,
 RIntegration,
 RInvite,
 RMessage,
 RRole,
 RStageInstance,
 RSticker,
 RThread,
 RUser,
 RWebhook,
} from '@ayako/utility';
import type {
 APIApplication,
 APIChannel,
 APIGuildForumTag,
 APIGuildIntegrationApplication,
 APIInviteGuild,
 APIMessageReference,
 APIPartialGuild,
 APIUser,
} from 'discord-api-types/v10';

import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import stp from '../../../Util/stp.js';

const makeInlineCode = (text: string) => `\`${text}\``;

export default (t: BaseLang) => ({
 getForumTag: (emotes: EmoteSet, tag: APIGuildForumTag, emoji?: REmoji | string) =>
  `**${emoji}${makeInlineCode(tag.name)} / ${makeInlineCode(tag.id)}${
   tag.moderated ? ` / ${constants.formatters.getEmote(emotes.userFlags.discordEmployee)}` : ''
  }**\n`,
 getGuild: (guild: RGuild | APIPartialGuild | APIInviteGuild) =>
  `**Server ${makeInlineCode(guild.name)} / ${makeInlineCode(guild.id)}${
   'vanityURLCode' in guild && guild.vanityURLCode
    ? ` / [${t.t.Join()}](https://discord.gg/${guild.vanityURLCode})`
    : ''
  }**\n`,
 getChannel: (
  channel:
   | RChannel
   | RThread
   | APIChannel
   | Partial<APIChannel>
   | { id: string; name: string }
   | null,
  type?: string,
 ) =>
  (channel
   ? `**${'type' in channel && channel.type ? t.channelTypes[channel.type]() : (type ?? t.t.Channel())} <#${channel.id}> / ${makeInlineCode(
      `${channel.name}`,
     )} / ${makeInlineCode(channel.id || '-')}**\n`
   : `**${t.channelTypes.unknownChannel()}**\n`),
 getUser: (user: RUser | APIUser | null) =>
  (user
   ? `**${user?.bot ? t.t.Bot() : t.t.User()} <@${user?.id}> / ${makeInlineCode(
      user ? constants.formatters.user(user) : t.t.Unknown(),
     )} / ${makeInlineCode(user?.id)}**\n`
   : `**${t.t.User()} ${t.t.Unknown()}**\n`),
 getAutoModerationRule: (rule: RAutomod) =>
  `**${t.t.AutoModRule()} ${makeInlineCode(rule.name)} / ${makeInlineCode(rule.id)}**\n`,
 getMessage: (msg: RMessage | APIMessageReference) =>
  `**[${t.t.thisMessage()}](${constants.formatters.msgURL(
   msg.guild_id,
   msg.channel_id || '@me',
   ('id' in msg ? msg.id : (msg.message_id ?? '')) || '',
  )})**\n`,
 getEmote: (emoji: REmoji) =>
  `**${t.t.Emoji()} ${constants.formatters.getEmote(emoji)} / \`${
   emoji.name ?? t.t.None()
  }\` / \`${emoji.id ?? t.t.None()}\`**\n`,
 getInvite: (invite: RInvite) =>
  `**${t.t.Invite()} https://discord.gg/${invite.code} / \`${invite.code}\`**\n`,
 getInviteDetails(invite: RInvite, channel?: RChannel, user?: RUser, channelType?: string) {
  return `**${t.t.Code()}: \`${invite.code}\`**\n${
   user ? `${t.t.Inviter()}: ${this.getUser(user)}` : ''
  }${t.t.Uses()}: ${invite.uses}\n${t.t.Created()}: ${
   invite.created_at
    ? constants.formatters.getTime(new Date(invite.created_at).getTime())
    : t.t.Unknown()
  }\n${this.getChannel(channel || null, channelType)}**`;
 },
 getIntegration: (integration: RIntegration) =>
  `**${t.t.Integration()} \`${integration.name}\` / \`${integration.id}\`**\n`,
 getRole: (role: RRole | { id: string; name: string }) =>
  `**${t.t.Role()} <@&${role.id}> / \`${role.name}\` / \`${role.id}\`**\n`,
 getApplication: (application: APIApplication | APIGuildIntegrationApplication | bigint) =>
  `**${t.t.Application()} ${
   typeof application === 'bigint'
    ? `<@${application}> / \`${application}\``
    : `<@${application.id}> / \`${application.name}\` / \`${application.id}\`**\n`
  }**`,
 getScheduledEvent: (event: REvent) =>
  `**${t.t.ScheduledEvent()} \`${event.name}\` / \`${event.id}\`**\n`,
 getWebhook: (webhook: RWebhook, type?: string) =>
  `**${type ? `${type} ` : ''}${t.t.Webhook()} \`${webhook.name}\` / \`${webhook.id}\`**\n`,
 getCommand: (command: RCommand | RGuildCommand) =>
  `**${t.t.Command()} </${command.name}:${command.id}> / \`${command.name}\` / \`${command.id}\`**\n`,
 getPunishment: (id: string, cId: string) =>
  `**${t.t.Punishment()} \`${Number(id).toString(36)}\`**\n${stp(t.t.lookupPunishment(), {
   cId,
  })}`,
 getSticker: (sticker: RSticker) =>
  `**${t.t.Sticker()} \`${sticker.name}\` / \`${sticker.id}\`**\n`,
 getStageInstance(stageInstance: RStageInstance, channel: RChannel) {
  return `**${t.t.stageInstance()} \`${stageInstance.topic}\` / \`${
   stageInstance.id
  }\`**\n> ${this.getChannel(channel)}`;
 },
 getAuditLog: (audit: RAuditLog) =>
  `**${t.t.auditLog()} \`${t.auditLogAction[audit.action_type]}\` / \`${audit.id}\`**\n`,
});
