import { RequestHandlerError } from '@ayako/api';
import { TicketState, TicketType } from '@ayako/database';
import { LogLevel } from '@ayako/utility';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import TicketPlugin from '../Plugin.js';
import type BaseTicket from './BaseTicket.js';
import { LogType } from './BaseTicketLogger.js';
import DmToChannelTicket from './DmToChannelTicket.js';
import DmToThreadTicket from './DmToThreadTicket.js';
import { DMTicketErrors } from './Enums.js';

type AbstractCtor<T = {}> = new (...args: any[]) => T;
export function DMTicketMixin<TBase extends AbstractCtor<BaseTicket>>(Base: TBase) {
 abstract class DMTicket extends Base {
  static async findTicketByDMChannelId(client: Client, channelId: string) {
   const entry = await client.db.client.ticket.findFirst({
    where: { dm: channelId },
    include: { settings: true },
   });
   if (!entry) return null;

   const ticketPlugin = client.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;
   if (!ticketPlugin) throw new Error(DMTicketErrors.ticketPluginNotFound);

   switch (true) {
    case entry.settings.type === TicketType.dmToChannel:
     return new DmToChannelTicket(client, String(entry.id), ticketPlugin);

    case entry.settings.type === TicketType.dmToThread:
     return new DmToThreadTicket(client, String(entry.id), ticketPlugin);

    default:
     throw new Error(DMTicketErrors.unknownTicketType, { cause: entry.settings.type });
   }
  }

  async replyMessage(
   cmd: APIMessageComponentInteraction,
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
   const api = await this.client.getAPI(ticket.settings.guild);

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
   }).setEmbeds([new EmbedBuilder().setDescription(t.leaveSure()).setColor(Colors.Danger)]);
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

  async pinMessage(message: APIMessage) {
   this.plugin.logger.logLocation(LogLevel.silly);

   const ticket = await this.getTicket();
   const api = await this.client.getAPI(ticket.settings.guild);

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

   const leftPayload = await this.getLeavePayload();
   await this.sendMessage(leftPayload);
   await this.updateMessage(cmd, this.getLeaveUpdatePayload());

   await this.setDbEntryLeft();
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
   const api = await this.client.getAPI(ticket.settings.guild);
   const modify = await api.interactions.updateMessage(cmd.id, cmd.token, payload.getAPIPayload(), {
    origin: DMTicket.name,
    reason: 'Updating message after leaving ticket',
   });

   if (!modify || !(modify instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(modify || new Error(), this.updateMessage.name);
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
     .setColor(Colors.Danger)
     .setDescription(
      `${constants.formatters.getEmote(emotes.crossWithBackground)}: ${t.leftTicket()}`,
     ),
   ]);
  }

  async unpinMessage() {
   this.plugin.logger.logLocation(LogLevel.silly);

   const ticket = await this.getTicket();
   if (!ticket.starterDm || !ticket.dm) return;
   const api = await this.client.getAPI(ticket.settings.guild);

   const unpin = await api.channels.unpinDirectMessage(ticket.dm, ticket.starterDm, {
    origin: DMTicket.name,
    reason: 'Unpinning leave confirmation message',
   });

   if (!(unpin instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(unpin, this.unpinMessage.name);
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
        .setCustomId('tickets/leave')
        .setLabel(t.leaveTicket())
        .setStyle(ButtonStyle.Danger),
      )
      .toJSON() as APIMessageTopLevelComponent,
    ]);
  }

  async setStarterDm(msgId: string | null) {
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
   const api = await this.client.getAPI(ticket.settings.guild);
   const unpin = await api.channels.unpinDirectMessage(ticket.dm, ticket.starterDm, {
    origin: DMTicket.name,
    reason: 'Unpinning starter DM message',
   });

   if (!(unpin instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(unpin, this.unpinStartMessage.name);
   return unpin;
  }

  async getCloseDmPayload() {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   return new MessagePayload(this.client, {
    origin: this.getCloseDmPayload.name,
    reason: 'Generating close DM payload',
   }).setEmbeds([
    {
     author: { name: `${emotes.tools.name} | ${t.SupportTeam()}` },
     description: t.hasClosedThreadRelay(),
     color: Colors.Danger,
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

   const api = await this.client.getAPI(ticket.settings.guild);
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

  async *close(data: { userId: string }) {
   const superClose = yield* super.close(data);

   const initialMessage = await this.editInitialMessage(this.getLeaveUpdatePayload());
   if (initialMessage) await this.unpinMessage();

   await this.setDbEntryLeft();

   return superClose;
  }

  async editInitialMessage(payload: MessagePayload) {
   const ticket = await this.getTicket();
   if (!ticket.starterDm || !ticket.dm) return;

   const api = await this.client.getAPI(ticket.settings.guild);
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
 }

 return DMTicket;
}
