import { RequestHandlerError } from '@ayako/api';
import { TicketType } from '@ayako/database';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import type TicketPlugin from '../Plugin.js';
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

   const ticketPlugin = client.plugins.find((p) => p.name === 'Ticketing') as TicketPlugin;
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
   const ticket = await this.getTicket();
   const api = await this.client.getAPI(ticket.settings.guild);
   const dm = await api.users.createDM(ticket.user, {
    origin: DMTicket.name,
    reason: 'Forwarding message to ticket DM channel',
   });

   if (!dm || dm instanceof RequestHandlerError) {
    throw new Error(DMTicketErrors.dmChannelNotFound, { cause: dm });
    // if (failIfError)
    // return this.plugin.nonFatalError(
    //  new Error(DMTicketErrors.dmChannelNotFound, { cause: dm }),
    //  this.forwardToDmChannel.name,
    // );
   }

   const send = await api.channels.createDirectMessage(dm.id, payload.getAPIPayload(), {
    origin: DMTicket.name,
    reason: 'Forwarding message to ticket DM channel',
   });

   if (!send || send instanceof RequestHandlerError) {
    throw new Error(DMTicketErrors.couldntSendDm);
    // if (failIfError)
    // this.plugin.nonFatalError(
    //  new Error(
    //   `Failed to send message to DM channel: ${send instanceof RequestHandlerError ? send : 'Unknown error'}`,
    //  ),
    //  this.forwardToDmChannel.name,
    // );
   }

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
   if (cmd.message.embeds.length) {
    this.leaveSure(cmd);
    return;
   }
   const payload = await this.getLeaveConfirmationPayload();
   payload.update(cmd);
  }

  async revokeChannelAccess() {
   return [];
  }

  async grantChannelAccess() {
   return;
  }

  async pinMessage(message: APIMessage) {
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
   await this.unpinMessage(cmd);

   const leftPayload = await this.getLeftPayload();
   await this.updateMessage(cmd, leftPayload);
  }

  async updateMessage(cmd: APIMessageComponentInteraction, payload: MessagePayload) {
   const ticket = await this.getTicket();
   const api = await this.client.getAPI(ticket.settings.guild);
   const modify = await api.interactions.updateMessage(cmd.id, cmd.token, payload.getAPIPayload(), {
    origin: DMTicket.name,
    reason: 'Updating message after leaving ticket',
   });

   if (modify && !(modify instanceof RequestHandlerError)) return;

   this.plugin.nonFatalError(modify || new Error(), this.updateMessage.name);
  }

  async getLeftPayload() {
   const ticket = await this.getTicket();
   const t = await this.plugin.t(ticket.settings.guild);

   return new MessagePayload(this.client, { origin: DMTicket.name, reason: 'User left ticket' })
    .setEmbeds([])
    .setComponents([])
    .setContent(t.ticketLeft());
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

  async unpinMessage(cmd: APIMessageComponentInteraction) {
   const ticket = await this.getTicket();
   const api = await this.client.getAPI(ticket.settings.guild);

   const unpin =
    cmd.channel.type === ChannelType.DM
     ? api.channels.unpinDirectMessage(cmd.channel.id, cmd.message.id, {
        origin: DMTicket.name,
        reason: 'Unpinning leave confirmation message',
       })
     : api.channels.unpinMessage(cmd.channel.id, cmd.message.id, {
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
   this.dbTicket = await this.client.db.client.ticket.update({
    where: { id: this.id },
    data: { starterDm: msgId },
    include: { settings: true },
   });

   return this.dbTicket;
  }

  async unpinStartMessage() {
   const ticket = await this.getTicket();
   if (!ticket.starterDm) return;

   const api = await this.client.getAPI(ticket.settings.guild);
   const unpin = await api.channels.unpinDirectMessage(ticket.dm!, ticket.starterDm, {
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
   const hasDmTicket = await this.hasDmTicket(dbOpts.userId);
   if (hasDmTicket) throw new Error(DMTicketErrors.create_userAlreadyInDmTicket);

   const create = super.create(dbOpts, createOpts);
   return yield* create;
  }

  async hasDmTicket(userId: string) {
   const existing = await this.client.db.client.ticket.findFirst({
    where: { user: userId },
   });
   return !!existing;
  }
 }

 return DMTicket;
}
