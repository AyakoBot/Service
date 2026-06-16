import { RequestHandlerError } from '@ayako/api';
import { TicketState, TicketType } from '@ayako/database';
import type { Ticket, TicketSetting } from '@ayako/database';
import { LogLevel, type RMessage } from '@ayako/utility';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import TicketPlugin from '../Plugin.js';
import { resolveStaffLabel } from '../Util/resolveStaffLabel.js';

import type { SurfaceState } from './BaseTicket.js';
import BaseTicket from './BaseTicket.js';
import { LogType } from './BaseTicketLogger.js';
import DmToChannelTicket from './DmToChannelTicket.js';
import DmToThreadTicket from './DmToThreadTicket.js';
import { DMTicketErrors } from './Enums.js';
import { TicketRoute } from './Routes.js';

/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */
type AbstractCtor<T = {}> = new (...args: any[]) => T;
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */

// eslint-disable-next-line func-style, @typescript-eslint/naming-convention
export function DMTicketMixin<TBase extends AbstractCtor<BaseTicket>>(Base: TBase) {
 abstract class DMTicket extends Base {
  static async findTicketByDMChannelId(
   client: Client,
   channelId: string,
  ): Promise<BaseTicket | null> {
   const entry = await client.db.client.ticket.findFirst({
    where: { dm: channelId },
    include: { settings: true },
   });
   if (!entry) return null;

   const ticketPlugin = client.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;
   if (!ticketPlugin) throw new Error(DMTicketErrors.ticketPluginNotFound);

   switch (entry.settings.type) {
    case TicketType.dmToChannel:
     return new DmToChannelTicket(client, String(entry.id), ticketPlugin);

    case TicketType.dmToThread:
     return new DmToThreadTicket(client, String(entry.id), ticketPlugin);

    default:
     throw new Error(DMTicketErrors.unknownTicketType, { cause: entry.settings.type });
   }
  }

  async replyMessage(
   cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
   payload: MessagePayload,
   errorCode: (typeof DMTicketErrors)[keyof typeof DMTicketErrors],
  ) {
   const modify = await payload.reply(cmd);

   if (modify instanceof RequestHandlerError) {
    this.plugin.nonFatalError(new Error(errorCode, { cause: modify }), this.replyMessage.name);
   }

   return modify;
  }

  async forwardToDmChannel(payload: MessagePayload) {
   this.plugin.logger.logLocation(LogLevel.debug);

   const ticket = await this.getTicket();
   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

   if (!ticket.dm) return null;

   const send = await api.channels.createDirectMessage(ticket.dm, payload.getAPIPayload(), {
    origin: DMTicket.name,
    reason: 'Forwarding message to ticket DM channel',
   });

   if (!send || send instanceof RequestHandlerError) throw new Error(DMTicketErrors.couldntSendDm);
   return send;
  }

  async getLeaveConfirmationPayload() {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   return new MessagePayload(this.client, {
    origin: DmToChannelTicket.name,
    reason: 'Generating leave confirmation payload',
   }).setEmbeds([new EmbedBuilder().setDescription(t.leaveSure()).setColor(Colors.Warning)]);
  }

  async leave(cmd: APIMessageComponentInteraction) {
   this.plugin.logger.logLocation(LogLevel.silly);
   if (cmd.message.embeds.length) {
    this.leaveSure(cmd);
    return;
   }

   const payload = await this.getLeaveConfirmationPayload();
   payload.update(cmd);
  }

  async setDbEntryLeft() {
   this.dbTicket = await this.client.db.client.ticket.update({
    where: { id: this.id },
    data: { dm: null },
    include: { settings: true },
   });
  }

  async revokeChannelAccess() {
   return [];
  }

  async grantChannelAccess() {
   return;
  }

  async staffThreadParentId(): Promise<string | null> {
   return null;
  }

  async pinMessage(message: APIMessage) {
   this.plugin.logger.logLocation(LogLevel.silly);

   const ticket = await this.getTicket();
   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

   const pin = await api.channels.pinDirectMessage(message.channel_id, message.id, {
    origin: DMTicket.name,
    reason: 'Pinning initial ticket message',
   });

   if (!pin) return;

   this.plugin.nonFatalError(pin || new Error(), this.pinMessage.name);
  }

  async leaveSure(cmd: APIMessageComponentInteraction) {
   const ticket = await this.getTicket();

   const leavePayload = await this.getLeavePayload();
   await this.forwardToDmChannel(leavePayload);

   await this.handleBaseLog({ type: LogType.TicketLeft, data: { userId: ticket.user } });
   await this.unpinMessage();

   await this.updateMessage(cmd, this.getLeaveUpdatePayload());

   await this.setDbEntryLeft();
   await this.refreshSurface();
  }

  getLeaveUpdatePayload() {
   return new MessagePayload(this.client, {
    origin: this.plugin.name,
    reason: 'Generating leave update payload',
   })
    .setEmbeds([])
    .setComponents([]);
  }

  async updateMessage(cmd: APIMessageComponentInteraction, payload: MessagePayload) {
   const ticket = await this.getTicket();
   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
   const modify = await api.interactions.updateMessage(cmd.id, cmd.token, payload.getAPIPayload(), {
    origin: DMTicket.name,
    reason: 'Updating message after leaving ticket',
   });

   if (modify instanceof RequestHandlerError) {
    this.plugin.nonFatalError(modify, this.updateMessage.name);
   }
  }

  async getLeavePayload() {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);
   const user = await this.client.cache.users.get(ticket.user);

   return new MessagePayload(this.client, {
    origin: DMTicket.name,
    reason: 'User left ticket',
   }).setEmbeds([
    new EmbedBuilder()
     .setAuthor({
      name: user?.username || t.base.t.unknownUser(),
      iconURL: user ? user.avatar_url || '' : '',
     })
     .setColor(Colors.Warning)
     .setDescription(
      `${constants.formatters.getEmote(emotes.crossWithBackground)}: ${t.leftTicket()}`,
     ),
   ]);
  }

  async unpinMessage() {
   this.plugin.logger.logLocation(LogLevel.silly);

   const ticket = await this.getTicket();
   if (!ticket.starterDm || !ticket.dm) return;
   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

   const unpin = await api.channels.unpinDirectMessage(ticket.dm, ticket.starterDm, {
    origin: DMTicket.name,
    reason: 'Unpinning leave confirmation message',
   });

   if (!(unpin instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(unpin, this.unpinMessage.name);
  }

  async getInitPayload(
   _mentionUser: boolean,
   staffThreadId?: string | null,
   stateOverride?: SurfaceState,
  ) {
   return super.getInitPayload(false, staffThreadId, stateOverride);
  }

  async getInitDmPayload() {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   return new MessagePayload(this.client, {
    origin: DMTicket.name,
    reason: 'Sending initial message in DM for ticket',
   })
    .setContent(t.startChatting())
    .setComponents([
     new ActionRowBuilder()
      .setComponents(
       new ButtonBuilder()
        .setCustomId(this.plugin.getRoute(TicketRoute.Leave))
        .setLabel(t.leaveTicket())
        .setStyle(ButtonStyle.Danger),
      )
      .toJSON() as APIMessageTopLevelComponent,
    ]);
  }

  async setStarterDm(msgId: string | null): Promise<Ticket & { settings: TicketSetting }> {
   this.plugin.logger.logLocation(LogLevel.silly);
   this.dbTicket = await this.client.db.client.ticket.update({
    where: { id: this.id },
    data: { starterDm: msgId },
    include: { settings: true },
   });

   return this.dbTicket;
  }

  async unpinStartMessage() {
   const ticket = await this.getTicket();
   if (!ticket.starterDm || !ticket.dm) {
    this.plugin.logger.logLocation(LogLevel.silly);
    return;
   }

   this.plugin.logger.logLocation(LogLevel.silly);
   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
   const unpin = await api.channels.unpinDirectMessage(ticket.dm, ticket.starterDm, {
    origin: DMTicket.name,
    reason: 'Unpinning starter DM message',
   });

   if (!(unpin instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(unpin, this.unpinStartMessage.name);
   return unpin;
  }

  async getCloseDmPayload(reason?: string, closerId?: string) {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   const fallback = { name: t.SupportTeam(), emote: emotes.tools };
   const author = closerId
    ? await resolveStaffLabel.call(this.client, ticket.settings.guild, closerId, fallback)
    : fallback;

   return new MessagePayload(this.client, {
    origin: this.getCloseDmPayload.name,
    reason: 'Generating close DM payload',
   }).setEmbeds([
    {
     author: {
      name: author.name,
      icon_url: author.emote ? constants.formatters.getEmoteUrl(author.emote) : undefined,
     },
     description: t.hasClosedThreadRelay(),
     color: Colors.Warning,
     ...(reason ? { fields: [{ name: t.base.t.Reason(), value: reason }] } : {}),
    },
   ]);
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

   await this.enforceCreateLimits(dbOpts.settingsId, dbOpts.userId);

   const hasDmTicket = await this.hasDmTicket(dbOpts.userId);
   if (hasDmTicket) throw new Error(DMTicketErrors.create_UserAlreadyInDmTicket);

   const create = super.create(dbOpts, createOpts);
   return yield* create;
  }

  async hasDmTicket(userId: string) {
   this.plugin.logger.logLocation(LogLevel.silly);

   const existing = await this.client.db.client.ticket.findFirst({
    where: {
     user: userId,
     dm: { not: null },
     state: { in: [TicketState.opened, TicketState.claimed] },
    },
   });

   return !!existing;
  }

  async setDmChannel() {
   const ticket = await this.getTicket();
   if (ticket.dm) return;

   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
   const dmChannel = await api.users.createDM(ticket.user, {
    origin: this.plugin.name,
    reason: 'Creating DM channel for ticket',
   });

   if (!dmChannel || dmChannel instanceof RequestHandlerError) {
    throw new Error(DMTicketErrors.create_CantCreateDMChannel, { cause: dmChannel });
   }

   this.dbTicket = await this.client.db.client.ticket.update({
    where: { id: ticket.id },
    data: { dm: dmChannel.id },
    include: { settings: true },
   });
  }

  async *close(data: { userId: string; cmd: APIModalSubmitInteraction; reason?: string }) {
   const superClose = yield* super.close(data);

   await this.forwardToDmChannel(await this.getCloseDmPayload(data.reason, data.userId));

   const initialMessage = await this.editInitialMessage(this.getLeaveUpdatePayload());
   if (initialMessage) await this.unpinMessage();

   await this.setDbEntryLeft();

   return superClose;
  }

  async autoClose({ reason }: { reason?: string }): Promise<this> {
   await super.autoClose({ reason });

   await this.forwardToDmChannel(await this.getCloseDmPayload(reason)).catch((error: Error) =>
    this.plugin.nonFatalError(error, 'autoClose'),
   );

   const initialMessage = await this.editInitialMessage(this.getLeaveUpdatePayload());
   if (initialMessage) await this.unpinMessage();

   await this.setDbEntryLeft();

   return this;
  }

  async editInitialMessage(payload: MessagePayload) {
   const ticket = await this.getTicket();
   if (!ticket.starterDm || !ticket.dm) return;

   const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);
   const modify = await api.channels.editDirectMessage(
    ticket.dm,
    ticket.starterDm,
    payload.getAPIPayload(),
    {
     origin: DMTicket.name,
     reason: 'Editing initial message after ticket closed',
    },
   );

   if (!modify || modify instanceof RequestHandlerError) {
    this.plugin.nonFatalError(
     modify || new Error(DMTicketErrors.close_CantEditInitMessage),
     this.editInitialMessage.name,
    );

    return null;
   }

   return modify;
  }

  async getMessageUrl() {
   this.plugin.logger.logLocation(LogLevel.silly);

   const ticket = await this.getTicket();
   if (!ticket.dm || !ticket.starterDm) {
    throw new Error(DMTicketErrors.create_CantGenerateMessageUrlNoDm);
   }

   return constants.formatters.msgURL(ticket.settings.guild, ticket.dm, ticket.starterDm);
  }

  async messageSent(msg: RMessage, internal: boolean = false) {
   if (internal) return super.messageSent(msg, true);

   const ticket = await this.getTicket();

   if (ticket.dm === msg.channel_id) {
    await super.messageSent(msg);
    await this.setLastMessage();
    await this.react(msg);
    return;
   }

   if (ticket.channel === msg.channel_id) return this.staffReply(msg);

   if (!(await this.startsWithPrefix(msg.content))) {
    await this.forwardToTicketChannel(msg);
    await this.setLastMessage();
    return BaseTicket.prototype.messageSent.call(this, msg);
   }
   await this.cloneToDm(msg);
   await this.setLastMessage();

   return super.messageSent(msg);
  }

  async propagateEdit(msg: RMessage) {
   const ticket = await this.getTicket();
   const { sendMessagePrefixes } = ticket.settings;

   if (msg.channel_id !== ticket.channel || !sendMessagePrefixes.length) {
    return super.propagateEdit(msg);
   }

   const mirror = await this.findMirror(msg.id);
   const hasPrefix = await this.startsWithPrefix(msg.content);

   if (mirror && hasPrefix) {
    await this.editMirror(mirror, {
     ...msg,
     content: this.removeSendMessagePrefixes(msg.content, sendMessagePrefixes),
    });
    this.messageEdited(msg, false, true);
    return;
   }

   if (mirror && !hasPrefix) {
    await this.deleteMirror(mirror);
    await this.unreact(msg);
    this.messageEdited(msg, false, true);
    return;
   }

   this.messageEdited(msg, true, false);
  }

  async staffReply(msg: RMessage) {
   const ticket = await this.getTicket();
   const { sendMessagePrefixes } = ticket.settings;
   const relay = !sendMessagePrefixes.length || (await this.startsWithPrefix(msg.content));
   if (!relay) {
    if (msg.channel_id !== ticket.channel) await this.mirrorInternalToChannel(msg);
    return BaseTicket.prototype.messageSent.call(this, msg, true);
   }

   msg.content = this.removeSendMessagePrefixes(msg.content, sendMessagePrefixes);
   const sent = await this.cloneToDm(msg);
   if (sent) await this.react(msg);
   await this.setLastMessage();
   return BaseTicket.prototype.messageSent.call(this, msg);
  }

  async mirrorInternalToChannel(msg: RMessage) {
   const container = await this.buildInternalNoteContainer(msg, msg.author_id, true);

   await this.sendMessage(
    new MessagePayload(this.client, {
     origin: DMTicket.name,
     reason: 'Mirroring internal note to ticket channel',
    })
     .setComponents([container.toJSON()])
     .setFlags(MessageFlags.IsComponentsV2),
   ).catch((error: Error) => this.plugin.nonFatalError(error, this.mirrorInternalToChannel.name));
  }

  async cloneToDm(msg: RMessage) {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   const fallback = { name: t.SupportTeam(), emote: emotes.tools };
   const authorName = await resolveStaffLabel.call(
    this.client,
    ticket.settings.guild,
    msg.author_id,
    fallback,
   );
   const container = this.buildMirrorContainer(msg, authorName, await this.forwardLabels());

   const sent = await this.forwardToDmChannel(
    new MessagePayload(this.client, {
     origin: DMTicket.name,
     reason: 'Forwarding message from ticket channel to DM',
    })
     .setComponents([container.toJSON()])
     .setFlags(MessageFlags.IsComponentsV2),
   ).catch((error: Error) => {
    this.plugin.nonFatalError(error, this.cloneToDm.name);
    return null;
   });

   return !!sent;
  }
 }

 return DMTicket;
}
