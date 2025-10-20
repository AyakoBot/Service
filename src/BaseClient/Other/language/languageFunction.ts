import {
 ChannelType,
 type APIApplication,
 type APIGuildForumTag,
 type APIGuildIntegrationApplication,
 type APIMessageReference,
 type APIPartialGuild,
} from '@discordjs/core';
import { cache } from 'src/BaseClient/Client.js';
import * as CT from '../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 getForumTag: (tag: APIGuildForumTag, emoji?: REmoji | string) =>
  `**${emoji}${t.util.util.makeInlineCode(tag.name)} / ${t.util.util.makeInlineCode(tag.id)}${
   tag.moderated
    ? ` / ${t.util.constants.standard.getEmote(t.util.emotes.userFlags.DiscordEmployee)}`
    : ''
  }**\n`,
 getGuild: (guild: RGuild | APIPartialGuild) =>
  `**Server ${t.util.util.makeInlineCode(guild.name)} / ${t.util.util.makeInlineCode(guild.id)}${
   'vanityURLCode' in guild && guild.vanityURLCode
    ? ` / [${t.JSON.t.Join}](https://discord.gg/${guild.vanityURLCode})`
    : ''
  }**\n`,
 getChannel: (
  channel:
   | RChannel
   | RThread
   | { id: string; name: string }
   | { id: string; recipient_id: string }
   | undefined
   | null,
  type?: string,
 ) =>
  channel
   ? `**${type ?? t.JSON.t.Channel} <#${channel.id}> / ${t.util.util.makeInlineCode(
      'name' in channel
       ? `${channel.name}`
       : `<@${'recipient_id' in channel ? channel.recipient_id : null}>`,
     )} / ${t.util.util.makeInlineCode(channel.id)}**\n`
   : `**${t.channelTypes.unknownChannel}**\n`,
 getUser: (
  user: RUser | { bot: boolean; id: string; username: string; discriminator: string } | null,
 ) =>
  user
   ? `**${user?.bot ? t.JSON.t.Bot : t.JSON.t.User} <@${user?.id}> / ${t.util.util.makeInlineCode(
      user ? t.util.constants.standard.user(user) : t.JSON.t.Unknown,
     )} / ${t.util.util.makeInlineCode(user?.id)}**\n`
   : t.JSON.t.unknownUser,
 getAutoModerationRule: (rule: RAutomod) =>
  `**${t.JSON.t.AutoModRule} ${t.util.util.makeInlineCode(rule.name)} / ${t.util.util.makeInlineCode(
   rule.id,
  )}**\n`,
 getMessage: (msg: RMessage | APIMessageReference) =>
  `**[${t.JSON.t.thisMessage}](${t.util.constants.standard.msgurl(
   msg.guild_id,
   msg.channel_id || '@me',
   ('id' in msg ? msg.id : (msg.message_id ?? '')) || '',
  )})**\n`,
 getEmote: (emoji: REmoji) =>
  `**${t.JSON.t.Emoji} ${t.util.constants.standard.getEmote(emoji)} / \`${
   emoji.name ?? t.JSON.t.None
  }\` / \`${emoji.id ?? t.JSON.t.None}\`**\n`,
 getInvite: (invite: RInvite) =>
  `**${t.JSON.t.Invite} https://discord.gg/${invite.code} / \`${invite.code}\`**\n`,
 async getInviteDetails(invite: RInvite, user?: RUser, channelType?: string) {
  return `**${t.JSON.t.Code}: \`${invite.code}\`**\n${
   user ? `${t.JSON.t.Inviter}: ${this.getUser(user)}` : ''
  }${t.JSON.t.Uses}: ${invite.uses}\n${t.JSON.t.Created}: ${
   invite.created_at
    ? t.util.constants.standard.getTime(new Date(invite.created_at).getTime())
    : t.JSON.t.Unknown
  }\n${this.getChannel(invite.channel_id ? await cache.channels.get(invite.channel_id) : undefined, channelType)}**`;
 },
 getIntegration: (integration: RIntegration) =>
  `**${t.JSON.t.Integration} \`${integration.name}\` / \`${integration.id}\`**\n`,
 getRole: (role: RRole | { id: string; name: string }) =>
  `**${t.JSON.t.Role} <@&${role.id}> / \`${role.name}\` / \`${role.id}\`**\n`,
 getApplication: (application: APIApplication | APIGuildIntegrationApplication | bigint) =>
  `**${t.JSON.t.Application} ${
   typeof application === 'bigint'
    ? `<@${application}> / \`${application}\``
    : `<@${application.id}> / \`${application.name}\` / \`${application.id}\`**\n`
  }**`,
 getScheduledEvent: (event: REvent) =>
  `**${t.JSON.t.ScheduledEvent} \`${event.name}\` / \`${event.id}\`**\n`,
 getWebhook: (webhook: RWebhook, type?: string) =>
  `**${type ? `${type} ` : ''}${t.JSON.t.Webhook} \`${webhook.name}\` / \`${webhook.id}\`**\n`,
 getCommand: (command: RCommand) =>
  `**${t.JSON.t.Command} </${command.name}:${command.id}> / \`${command.name}\` / \`${command.id}\`**\n`,
 getPunishment: (id: string, cId: string) =>
  `**${t.JSON.t.Punishment} \`${Number(id).toString(36)}\`**\n${t.util.stp(
   t.JSON.t.lookupPunishment,
   {
    cId,
   },
  )}`,
 getSticker: (sticker: RSticker) =>
  `**${t.JSON.t.Sticker} \`${sticker.name}\` / \`${sticker.id}\`**\n`,
 async getStageInstance(stageInstance: RStage) {
  return `**${t.JSON.t.stageInstance} \`${stageInstance.topic}\` / \`${stageInstance.id}\`**\n> ${this.getChannel(
   await cache.channels.get(stageInstance.channel_id),
   t.channelTypes[ChannelType.GuildStageVoice],
  )}`;
 },
 getAuditLog: (audit: RAuditLog) =>
  `**${t.JSON.t.auditLog} \`${t.auditLogAction[audit.action_type]}\` / \`${audit.id}\`**\n`,
});
