import type { API } from '@ayako/api';
import { RequestHandlerError } from '@ayako/api';
import { LogLevel, type RChannel, type RMessage, type RThread } from '@ayako/utility';
import { TextDisplayBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 MessageFlags,
 OverwriteType,
 PermissionFlagsBits,
 type APIActionRowComponent,
 type APIButtonComponentWithCustomId,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import getUser from '../../../Util/getUser.js';
import type TicketPlugin from '../Plugin.js';
import { encodeContext, TicketContextType } from '../Util/transcriptContext.js';

import BaseTicket from './BaseTicket.js';
import { ChannelTicketErrors } from './Enums.js';

export default class ChannelTicket extends BaseTicket {
 static threadTypes = [
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
 ];

 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
  this.plugin = plugin;
 }

 // eslint-disable-next-line require-yield
 async *delete(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superDel = super.delete(data);
  await superDel.next();

  const deletePayload = await this.getDeletePayload();
  await this.replyMessage(data.cmd, deletePayload, ChannelTicketErrors.delete_CantUpdateMessage);

  await this.archiveStaffThread();
  await this.deleteChannel();
  await superDel.next();

  return true;
 }

 async deleteChannel() {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);
  const res = await api.channels.delete(ticket.channel, {
   origin: ChannelTicket.name,
   reason: 'Ticket deleted',
  });

  if (res && res instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.delete_CantDeleteChannel, { cause: res });
  }

  return res;
 }

 async replyMessage(
  cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
  payload: MessagePayload,
  errorCode: (typeof ChannelTicketErrors)[keyof typeof ChannelTicketErrors],
 ) {
  const modify = await payload.reply(cmd);

  if (!modify || modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(new Error(errorCode, { cause: modify }), this.replyMessage.name);
  }

  return modify;
 }

 async getDeletePayload() {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: '"Prepping delete" message',
  })
   .setEmbeds([])
   .setComponents([])
   .setContent(t.deleting());
 }

 // eslint-disable-next-line require-yield
 async *close(data: { userId: string; cmd: APIModalSubmitInteraction; reason?: string }) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const superClose = super.close({ userId: data.userId, reason: data.reason });
  await superClose.next();

  const closeInitPayload = await this.getCloseInitPayload(data.cmd);
  await this.updateInitCloseMessage(data.cmd, closeInitPayload);

  const ticket = await this.getTicket();
  const channel = await this.getChannel(ticket.channel);

  const api = await this.client.getAPI(ticket.settings.guild);
  await this.closeChannel(api, channel);
  await this.revokeChannelAccess(api, channel);
  await this.lockStaffThread();
  await this.applyLifecycleTags(ticket.settings.closeTags);

  const closeReplyPayload = await this.getCloseReplyPayload(data.reason, data.userId);
  await this.replyMessage(data.cmd, closeReplyPayload, ChannelTicketErrors.close_CantReplyMessage);

  await superClose.next();
  return this;
 }

 async getCloseReplyPayload(reason?: string, closerId?: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const deleteBtn: APIActionRowComponent<APIButtonComponentWithCustomId> = {
   type: ComponentType.ActionRow,
   components: [
    {
     type: ComponentType.Button,
     style: ButtonStyle.Danger,
     custom_id: `tickets/delete_${ticket.id}`,
     label: t.base.t.Delete(),
    },
    ...(closerId
     ? [
        {
         type: ComponentType.Button as const,
         style: ButtonStyle.Secondary as const,
         custom_id: encodeContext(TicketContextType.Closed, closerId, String(ticket.id)),
         label: '​',
         disabled: true,
        },
       ]
     : []),
   ],
  };

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Closing ticket',
  })
   .setEmbeds([
    {
     author: { name: `${emotes.tools.name} | ${t.SupportTeam()}` },
     description: t.hasClosedThread(),
     color: Colors.Danger,
     ...(reason ? { fields: [{ name: t.base.t.Reason(), value: reason }] } : {}),
    },
   ])
   .setComponents([deleteBtn]);
 }

 async revokeChannelAccess(api: API, channel: RChannel | RThread) {
  if (!this.isChannel(channel)) throw new Error(ChannelTicketErrors.badChannelSupplied);

  this.plugin.logger.logLocation(LogLevel.debug);
  const modify = await Promise.all(
   channel.permission_overwrites
    ?.filter((o) => o.type === OverwriteType.Member)
    .map((o) =>
     api.channels.deletePermissionOverwrite(channel.id, o.id, {
      origin: ChannelTicket.name,
      reason: 'Removing user permissions on ticket close',
     }),
    ) || [],
  );

  const errors = modify.filter((m) => m instanceof RequestHandlerError);
  errors.forEach((error) => this.plugin.nonFatalError(error, this.revokeChannelAccess.name));

  return modify;
 }

 isChannel(channel: RChannel | RThread): channel is RChannel {
  return !ChannelTicket.threadTypes.includes(channel.type);
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const archiveCategory = await this.getChannel(ticket.settings.archiveCategory || '');
  if (!this.isChannel(archiveCategory)) throw new Error(ChannelTicketErrors.badChannelSupplied);

  const t = await this.plugin.t(ticket.settings.guild);

  const modify = await api.channels.edit(
   ticket.channel,
   {
    name: `${t.closed()}-${channel?.name?.replace(t.claimed(), '')}`.slice(0, 30),
    parent_id: archiveCategory?.id || undefined,
    permission_overwrites:
     archiveCategory?.permission_overwrites?.map((o) => ({
      id: o.id,
      type: o.type,
      allow: String(o.allow),
      deny: String(o.deny),
     })) || undefined,
   },
   { origin: ChannelTicket.name, reason: 'Closing ticket' },
  );

  if (!modify || modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(
    modify || new Error(ChannelTicketErrors.close_CantEditChannel, { cause: modify }),
    this.closeChannel.name,
   );
  }

  return modify;
 }

 async updateInitCloseMessage(cmd: APIModalSubmitInteraction, payload: MessagePayload) {
  if (!cmd.message) return null;

  const modify = await payload.edit(cmd.message.channel_id, cmd.message.id);
  if (!modify || modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.close_CantEditInitMessage, { cause: modify });
  }

  return modify;
 }

 async getCloseInitPayload(cmd: APIModalSubmitInteraction) {
  const isV2 =
   ((cmd.message?.flags ?? 0) & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;

  const payload = new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Updating close message',
  }).setComponents(
   cmd.message?.components?.map((row) => {
    if (row.type !== ComponentType.ActionRow) return row;

    return {
     type: ComponentType.ActionRow as const,
     components: row.components.map((btn) => ({
      ...btn,
      disabled:
       'custom_id' in btn &&
       (btn.custom_id?.startsWith('tickets/close_') ||
        btn.custom_id?.startsWith('tickets/claim_'))
        ? true
        : btn.disabled,
     })),
    };
   }) ?? [],
  );

  if (isV2) payload.setFlags(MessageFlags.IsComponentsV2);

  return payload;
 }

 // eslint-disable-next-line require-yield
 async *claim(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superClaim = super.claim({ userId: data.userId });
  await superClaim.next();
  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);

  const channel = await this.getChannel(ticket.channel);
  const user = await getUser
   .call(this.client, data.userId)
   .then((r) => (r instanceof RequestHandlerError ? null : r));

  await this.claimChannel(api, channel.id, ticket.settings.guild, user?.username || channel.name);
  await this.addClaimerToStaffThread(data.userId);
  await this.applyLifecycleTags(
   ticket.settings.claimTags,
   ticket.settings.tagClaimer ? user?.username || null : null,
  );
  const claimPayload = await this.getClaimPayload(data.cmd, data.userId);
  await this.updateInitClaimMessage(data.cmd, claimPayload);

  const t = await this.plugin.t(ticket.settings.guild);
  await this.sendStateChange(
   TicketContextType.Claimed,
   data.userId,
   `-# ${t.claimedBy()}: <@${data.userId}>`,
  );

  await superClaim.next();

  return this;
 }

 async getChannel(id: string): Promise<RChannel | RThread> {
  const channel = await this.client.cache.channels.get(id);
  if (!channel) throw new Error(ChannelTicketErrors.channelNotFound);

  return channel;
 }

 async updateInitClaimMessage(cmd: APIMessageComponentInteraction, payload: MessagePayload) {
  const modify = await payload.update(cmd);
  if (modify && modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.claim_CantEditMessage, { cause: modify });
  }

  return modify;
 }

 async getClaimPayload(cmd: APIMessageComponentInteraction, claimerId: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const isV2 =
   ((cmd.message.flags ?? 0) & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;

  const claimedBy = `${t.claimedBy()}: <@${claimerId}>`;
  const payload = new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Updating claim message',
  })
   .setAllowedMentionsUsers([claimerId])
   .setAllowedMentionsRoles([]);

  if (!isV2) {
   return payload.setContent(claimedBy).setComponents(
    cmd.message.components?.map((row) => {
     if (row.type !== ComponentType.ActionRow) return row;

     return {
      type: ComponentType.ActionRow as const,
      components: row.components.map((btn) => ({
       ...btn,
       disabled:
        'custom_id' in btn && btn.custom_id?.startsWith('tickets/claim_') ? true : btn.disabled,
      })),
     };
    }) ?? [],
   );
  }

  let replaced = false;
  const components = (cmd.message.components ?? []).map((c) => {
   if (c.type === ComponentType.TextDisplay && !replaced && /<@&?\d+>/.test(c.content)) {
    replaced = true;
    return new TextDisplayBuilder().setContent(claimedBy).toJSON();
   }

   if (c.type !== ComponentType.ActionRow) return c;

   return {
    type: ComponentType.ActionRow as const,
    components: c.components.map((btn) => ({
     ...btn,
     disabled:
      'custom_id' in btn && btn.custom_id?.startsWith('tickets/claim_') ? true : btn.disabled,
    })),
   };
  });

  if (!replaced) components.unshift(new TextDisplayBuilder().setContent(claimedBy).toJSON());

  return payload.setFlags(MessageFlags.IsComponentsV2).setComponents(components);
 }

 async claimChannel(api: API, channelId: string, guildId: string, channelName: string) {
  this.plugin.logger.logLocation(LogLevel.debug);
  const t = await this.plugin.t(guildId);

  const modify = await api.channels.edit(
   channelId,
   { name: `${t.claimed()}-${channelName}`.slice(0, 30) },
   { origin: ChannelTicket.name, reason: 'Ticket claimed' },
  );

  if (!modify || modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.claim_CantEditChannel, { cause: modify });
  }

  return modify;
 }

 // eslint-disable-next-line require-yield
 async *create(
  dbOpts: { settingsId: string; userId: string },
  createOpts: {
   cmd: APIMessageComponentInteraction;
   userId: string;
   roleIds: string[];
   username: string;
  },
 ) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superCreate = super.create(dbOpts, createOpts);
  await superCreate.next();

  try {
   const ticketSettings = await this.getTicketSettings(dbOpts.settingsId);
   const api = await this.client.getAPI(ticketSettings.guild);
   const channel = await this.createChannel(api, createOpts.username, dbOpts.settingsId);

   await superCreate.next({ channelId: channel.id });

   await this.grantChannelAccess(api, channel.id, createOpts.userId);

   const initPayload = await this.getInitPayload(true);
   const initMessage = await this.sendMessage(initPayload);

   const pin = await api.channels.pinMessage(channel.id, initMessage.id, {
    origin: ChannelTicket.name,
    reason: 'Pinning initial ticket message',
   });
   if (pin instanceof RequestHandlerError) this.plugin.nonFatalError(pin, this.create.name);

   await this.createStaffThread(initMessage.id);

   const replyPayload = await this.getCreateReplyPayload(channel.id, initMessage.id);
   await this.replyMessage(
    createOpts.cmd,
    replyPayload,
    ChannelTicketErrors.create_CantReplyMessage,
   );

   return this;
  } finally {
   this.deletePreparedEntry();
  }
 }

 async getCreateReplyPayload(channelId: string, messageId: string) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: this.plugin.name,
   reason: 'Replying to ticket creation interaction',
  })
   .setContent(`${t.ticketed()} => ${await this.getMessageUrl(channelId, messageId)}`)
   .setFlags(MessageFlags.Ephemeral);
 }

 async getMessageUrl(channelId: string, messageId: string) {
  const ticket = await this.getTicket();
  return constants.formatters.msgURL(ticket.settings.guild, channelId, messageId);
 }

 async createChannel(api: API, username: string, settingsId: string): Promise<RChannel | RThread> {
  this.plugin.logger.logLocation(LogLevel.debug);
  const ticketSettings = await this.getTicketSettings(settingsId);

  const channel = await api.guilds.createChannel(
   ticketSettings.guild,
   {
    name: username,
    type: ChannelType.GuildText,
    parent_id: ticketSettings.category,
   },
   { origin: ChannelTicket.name, reason: 'Creating channel for ticket' },
  );

  if (!channel || channel instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.create_CantCreateChannel, { cause: channel });
  }

  return channel;
 }

 async grantChannelAccess(api: API, channelId: string, userId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);
  const modify = await api.channels.editPermissionOverwrite(
   channelId,
   userId,
   {
    type: OverwriteType.Member,
    allow: String(
     PermissionFlagsBits.ViewChannel |
      PermissionFlagsBits.SendMessages |
      PermissionFlagsBits.AttachFiles |
      PermissionFlagsBits.EmbedLinks,
    ),
   },
   {
    origin: ChannelTicket.name,
    reason: 'Setting permissions for ticket channel',
   },
  );

  if (modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.create_CantUpdatePermissions, { cause: modify });
  }

  return modify;
 }

 async messageSent(msg: RMessage, internal: boolean = false) {
  const ticket = await this.getTicket();

  if (internal || msg.channel_id === ticket.channel) return super.messageSent(msg, true);

  await this.forwardToTicketChannel(msg);

  return super.messageSent(msg);
 }

 async staffThreadParentId(): Promise<string | null> {
  const ticket = await this.getTicket();
  if (!ticket.settings.staffThreads) return null;
  return ticket.channel;
 }

 staffThreadType(): ChannelType.PublicThread | ChannelType.PrivateThread {
  return ChannelType.PrivateThread;
 }

 async findStaffThread(): Promise<RThread | null> {
  const parentId = await this.staffThreadParentId();
  if (!parentId) return null;

  const ticket = await this.getTicket();
  const threads = await this.client.cache.threads.getAll(ticket.settings.guild, parentId);
  return threads?.find((th) => th.name === `staff-${this.id}`) || null;
 }

 async getStaffThreadId(): Promise<string | null> {
  return (await this.findStaffThread())?.id || null;
 }

 async getStaffIntroPayload() {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Creating staff thread intro message',
  }).setEmbeds([
   { author: { name: t.ticketSystem() }, description: t.staffIntro(), color: Colors.Ephemeral },
  ]);
 }

 async createStaffThread(initMessageId: string): Promise<void> {
  const parentId = await this.staffThreadParentId();
  if (!parentId) return;

  this.plugin.logger.logLocation(LogLevel.debug);

  const intro = await this.getStaffIntroPayload();
  const thread = await this.createNamedThread(
   parentId,
   `staff-${this.id}`,
   this.staffThreadType(),
   intro,
  );
  if (!thread) return;

  await this.editInitWithStaffMention(initMessageId, thread.id);
 }

 async editInitWithStaffMention(initMessageId: string, staffThreadId: string) {
  const ticket = await this.getTicket();

  const payload = await this.getInitPayload(true, staffThreadId);
  const modify = await payload.edit(ticket.channel, initMessageId);
  if (modify instanceof RequestHandlerError) {
   this.plugin.nonFatalError(modify, this.editInitWithStaffMention.name);
  }
 }

 async addClaimerToStaffThread(userId: string) {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);
  const res = await api.threads.addMember(thread.id, userId, {
   origin: ChannelTicket.name,
   reason: 'Adding claimer to staff thread',
  });

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.addClaimerToStaffThread.name);
  }
 }

 async lockStaffThread() {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);
  const res = await api.channels.edit(
   thread.id,
   { locked: true },
   { origin: ChannelTicket.name, reason: 'Locking staff thread on close' },
  );

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.lockStaffThread.name);
  }
 }

 async archiveStaffThread() {
  const thread = await this.findStaffThread();
  if (!thread) return;

  const ticket = await this.getTicket();
  const api = await this.client.getAPI(ticket.settings.guild);
  const res = await api.channels.edit(
   thread.id,
   { archived: true },
   { origin: ChannelTicket.name, reason: 'Archiving staff thread on delete' },
  );

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.archiveStaffThread.name);
  }
 }
}
