import { RequestHandlerError } from '@ayako/api';
import type { TicketSetting as PrismaTicketSetting } from '@ayako/database';
import { TicketType } from '@ayako/database';
import type { RUser } from '@ayako/utility';
import { TextDisplayBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 MessageFlags,
 OverwriteType,
 PermissionFlagsBits,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import showCommandError from '../../../../Util/showCommandError.js';

import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';
import TicketSetting from '../../TicketSetting.js';

import { handleLog, LogType } from './util.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const id = args.pop();
 if (!id) {
  this.client.logger.error('No ID provided for ticket creation');
  return;
 }

 const user = cmd.user || cmd.member?.user;

 if (!user) {
  this.client.logger.error('User not found on Command');
  return;
 }

 const base = new TicketSetting(this.client, id);
 const settings = await base.getWithInclude({ Ticket: { where: { user: user.id } } });
 const t = await this.t(cmd.guild_id);

 if (!settings || !settings.active || !settings.channel) {
  showCommandError.call(this.client, t.notActive(), cmd, t.base);
  return;
 }

 const member = await this.client.cache.members.get(cmd.guild_id, user.id);
 if (!member) {
  this.client.logger.error('Member not found in cache:', user.id);
  showCommandError.call(this.client, t.base.errors.memberNotFound(), cmd, t.base);
  return;
 }

 if (
  settings.denyUsers.includes(user.id) ||
  settings.denyRoles.some((r) => member.roles.includes(r))
 ) {
  showCommandError.call(this.client, t.blocked(), cmd, t.base);
  return;
 }

 if (settings.Ticket.length) {
  showCommandError.call(this.client, t.alreadyInTicket(), cmd, t.base);
  return;
 }

 const otherDmTickets = await Ticket.findMany(this.client, {
  where: { user: user.id },
 });

 if (otherDmTickets.length) {
  showCommandError.call(this.client, t.alreadyInTicket(), cmd, t.base);
  return;
 }

 let dmId: string | undefined = undefined;
 const api = await this.client.getAPI(cmd.guild_id);

 if ([TicketType.dmToThread, TicketType.dmToChannel].includes(settings.type)) {
  dmId = await dmTicketHandler.call(
   this,
   settings,
   t,
   cmd,
   api,
   this.client.cache.users.apiToR(user),
  );
 }

 const channel = await this.client.cache.channels.get(settings.channel);
 if (!channel) {
  showCommandError.call(this.client, t.base.errors.channelNotFound(), cmd, t.base);
  return;
 }

 const supportChannel = [TicketType.dmToThread, TicketType.Thread].includes(settings.type)
  ? await api.channels.createThread(
     channel.id,
     {
      name: user.username,
      type: ChannelType.PrivateThread,
      auto_archive_duration: Number(settings.archiveDuration),
     },
     undefined,
     { origin: this.name, reason: 'Creating thread for ticket' },
    )
  : await api.guilds.createChannel(
     cmd.guild_id,
     {
      name: user.username,
      type: ChannelType.GuildText,
      parent_id: settings.category,
     },
     { origin: this.name, reason: 'Creating channel for ticket' },
    );

 if (!supportChannel || supportChannel instanceof RequestHandlerError) {
  showCommandError.call(this.client, t.cantCreateChannel(), cmd, t.base);
  return;
 }

 if (settings.type === TicketType.Channel) {
  api.channels.editPermissionOverwrite(
   supportChannel.id,
   user.id,
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
    origin: this.name,
    reason: 'Setting permissions for ticket channel',
   },
  );
 }

 // TODO: set custom embed
 const initPayload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Creating initial ticket message',
 }).setContent('This will be a custom embed');

 const msg = await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Creating ticket message',
 })
  .setAllowedMentionsUsers(settings.mentionUsers)
  .setAllowedMentionsRoles(settings.mentionRoles)
  .setContent(
   `${
    [TicketType.Channel, TicketType.Thread].includes(settings.type) ? `<@${user.id}>` : ''
   }\n${settings.mentionRoles.map((r) => `<@&${r}>`).join(' ')}\n${settings.mentionUsers
    .map((u) => `<@${u}>`)
    .join(' ')}`,
  )
  .setEmbeds([
   initPayload.embeds[0],
   ...(settings.sendMessagePrefixes.length
    ? [
       {
        author: { name: t.replyWith() },
        description: settings.sendMessagePrefixes.map((p) => `\`${p}\``).join(', '),
       },
      ]
    : []),
  ])
  .setComponents([
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      custom_id: `info/user_${user.id}`,
      label: t.userInfo(),
      style: ButtonStyle.Secondary,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      custom_id: `tickets/close_${settings.id}`,
      label: t.closeTicket(),
      style: ButtonStyle.Danger,
     },
     {
      type: ComponentType.Button,
      custom_id: `tickets/claim_${settings.id}_${user.id}`,
      label: t.claimTicket(),
      style: ButtonStyle.Success,
     },
    ],
   },
  ])
  .setSendTo([{ channel: supportChannel.id, guildId: cmd.guild_id }])
  .send()
  .then((m) => m[0]);

 if (!msg || msg instanceof RequestHandlerError) {
  showCommandError.call(this.client, t.cantCreateChannel(), cmd, t.base);
  api.channels.delete(supportChannel.id, {
   origin: this.name,
   reason: 'Deleting ticket channel due to error',
  });

  Ticket.delete(this.client, { user: user.id }).then();
  return;
 }

 if ([TicketType.Channel, TicketType.Thread].includes(settings.type)) {
  new MessagePayload(this.client, {
   origin: this.name,
   reason: 'Replying to ticket creation interaction',
  })
   .setContent(
    `${t.ticketed()} => ${constants.formatters.msgURL(cmd.guild_id, supportChannel.id, msg.id)}`,
   )
   .setFlags(MessageFlags.Ephemeral)
   .reply(cmd);
 }

 const ticket = await new Ticket(this.client, Date.now().toString()).upsert(
  {
   id: Date.now().toString(),
   dm: dmId,
   channel: supportChannel.id,
   userId: user.id,
   settings: settings.id,
  },
  {
   channel: supportChannel.id,
   dm: dmId,
   user: user.id,
   settingsId: settings.id,
   id: new Date().toString(),
  },
 );

 if (!settings.logChannels.length) return;

 handleLog.call(this, String(ticket.id), {
  type: LogType.TicketCreated,
  data: {
   user: this.client.cache.users.apiToR(user),
   channel: supportChannel,
  },
 });
}

async function dmTicketHandler(
 this: TicketPlugin,
 settings: PrismaTicketSetting,
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 cmd: APIMessageComponentInteraction,
 api: Awaited<ReturnType<typeof this.client.getAPI>>,
 user: RUser,
) {
 if (
  (!settings.channel && settings.type === TicketType.dmToThread) ||
  (!settings.category && settings.type === TicketType.dmToChannel)
 ) {
  showCommandError.call(this.client, t.notActive(), cmd, t.base);
  return;
 }

 const dm = await api.users.createDM(user!.id, {
  origin: this.name,
  reason: 'Creating DM for ticket',
 });

 if (dm instanceof RequestHandlerError) {
  showCommandError.call(this.client, t.cantOpenDMs(), cmd, t.base);
  return;
 }

 const msg =
  dm && !('message' in dm)
   ? await api.channels.createDirectMessage(
      dm.id,
      {
       content: t.startChatting(),
       components: [
        {
         type: ComponentType.ActionRow,
         components: [
          {
           type: ComponentType.Button,
           custom_id: `tickets/leave_${settings.id}`,
           label: t.leaveTicket(),
           style: ButtonStyle.Danger,
          },
         ],
        },
       ],
      },
      {
       origin: this.name,
       reason: 'Sending initial message in DM for ticket',
      },
     )
   : undefined;

 if (!msg || msg instanceof RequestHandlerError) {
  showCommandError.call(this.client, t.openDMs(), cmd, t.base);
  return;
 }

 api.channels.pinDirectMessage(dm.id, msg.id, {
  origin: this.name,
  reason: 'Pinning initial message in DM for ticket',
 });

 new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Replying to ticket creation interaction',
 }).setComponents([
  new TextDisplayBuilder()
   .setContent(`${t.dmd()} => ${constants.formatters.msgURL('@me', dm.id, msg.id)}`)
   .toJSON(),
 ]);

 return dm.id;
}
