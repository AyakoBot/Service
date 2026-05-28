import { API, RequestHandlerError } from '@ayako/api';
import { LogLevel, type RChannel, type RMessage, type RThread } from '@ayako/utility';
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
} from 'discord-api-types/v10';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import getUser from '../../../Util/getUser.js';
import type TicketPlugin from '../Plugin.js';
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

 async *delete(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);
  const superDel = super.delete(data);
  await superDel.next();

  const deletePayload = await this.getDeletePayload();
  await this.replyMessage(data.cmd, deletePayload, ChannelTicketErrors.delete_CantUpdateMessage);

  await this.deleteChannel();
  await superDel.next();

  return true;
 }

 async deleteChannel() {
  const ticket = await this.getTicket();
  this.plugin.logger.debug(
   '[ChannelTicket] deleteChannel ticket:',
   this.id,
   'channel:',
   ticket.channel,
  );
  const res = (await this.client.getAPI(ticket.settings.guild)).channels.delete(ticket.channel, {
   origin: ChannelTicket.name,
   reason: 'Ticket deleted',
  });

  if (res && res instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.delete_CantDeleteChannel, { cause: res });
  }

  return res;
 }

 async replyMessage(
  cmd: APIMessageComponentInteraction,
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

 async *close(data: { userId: string; cmd: APIMessageComponentInteraction }) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const superClose = super.close({ userId: data.userId });
  await superClose.next();

  const closeInitPayload = await this.getCloseInitPayload(data.cmd);
  await this.updateInitCloseMessage(data.cmd, closeInitPayload);

  const ticket = await this.getTicket();
  const channel = await this.getChannel(ticket.channel);

  const api = await this.client.getAPI(ticket.settings.guild);
  await this.closeChannel(api, channel);
  await this.revokeChannelAccess(api, channel);

  const closeReplyPayload = await this.getCloseReplyPayload();
  await this.replyMessage(data.cmd, closeReplyPayload, ChannelTicketErrors.close_CantReplyMessage);

  await superClose.next();
  return this;
 }

 async getCloseReplyPayload() {
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

 async updateInitCloseMessage(cmd: APIMessageComponentInteraction, payload: MessagePayload) {
  const modify = await payload.edit(cmd.channel.id, cmd.message.id);
  if (!modify || modify instanceof RequestHandlerError) {
   throw new Error(ChannelTicketErrors.close_CantEditInitMessage, { cause: modify });
  }

  return modify;
 }

 async getCloseInitPayload(cmd: APIMessageComponentInteraction) {
  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Updating close message',
  }).setComponents(
   cmd.message.components?.map((row) => {
    if (row.type !== ComponentType.ActionRow) return row;

    return {
     type: ComponentType.ActionRow as const,
     components: row.components.map((btn) => ({
      ...btn,
      disabled:
       'custom_id' in btn &&
       (btn.custom_id?.startsWith('tickets/close_') || btn.custom_id?.startsWith('tickets/claim_'))
        ? true
        : btn.disabled,
     })),
    };
   }) ?? [],
  );
 }

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
  const claimPayload = await this.getClaimPayload(data.cmd);
  await this.updateInitClaimMessage(data.cmd, claimPayload);

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

 async getClaimPayload(cmd: APIMessageComponentInteraction) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  return new MessagePayload(this.client, {
   origin: ChannelTicket.name,
   reason: 'Updating claim message',
  })
   .setContent(`${t.claimedBy()}: <@${ticket.user}>`)
   .setComponents(
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

   const initPayload = await this.getInitPayload(true, false);
   const initMessage = await this.sendMessage(initPayload);

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

 async messageSent(msg: RMessage) {
  const ticket = await this.getTicket();

  if (msg.channel_id === ticket.channel) return super.messageSent(msg, true);

  await this.forwardToTicketChannel(msg);

  return super.messageSent(msg);
 }
}
