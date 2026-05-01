import type {
 Ticket as PrismaTicket,
 TicketSetting as PrismaTicketSettings,
} from '@ayako/database';
import { TicketState, TicketType } from '@ayako/database';
import type { RChannel } from '@ayako/utility';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 OverwriteType,
 ThreadAutoArchiveDuration,
 type APIActionRowComponent,
 type APIButtonComponentWithCustomId,
 type APIMessageComponentInteraction,
 type APIPartialInteractionGuild,
 type APIUser,
} from 'discord-api-types/v10';

import showCommandError from '../../../../Util/showCommandError.js';

import { RequestHandlerError } from '@ayako/api';
import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';
import { handleLog, LogType } from './util.js';
import emotes from '../../../../Classes/Emotes.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!cmd.guild) return;
 if (!cmd.channel) return;

 const user = cmd.user || cmd.member?.user;
 if (!user) return;

 const ticketId = args.pop() as string;
 if (!ticketId) return;

 const channel =
  (await this.client.cache.channels.get(cmd.channel.id)) ||
  (await this.client.cache.threads.get(cmd.channel.id));
 if (!channel) return;

 const t = await this.t(cmd.guild_id);

 if (channel.name.startsWith(`${t.closed()}-`)) {
  showCommandError.call(this.client, t.alreadyClosed(), cmd, t.base);

  return;
 }

 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket || !ticket.settings || !ticket.settings.active) {
  showCommandError.call(this.client, t.notFound(), cmd, t.base);
  return;
 }

 if (
  !ticket.settings.allowCreatorClose &&
  ticket.user === user.id &&
  [TicketType.Thread, TicketType.Channel].includes(ticket.settings.type)
 ) {
  showCommandError.call(this.client, t.onlyStaffCanClose(), cmd, t.base);
  return;
 }

 new Ticket(this.client, ticketId).update({ state: TicketState.closed }).then();

 new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Updating close message',
 })
  .setComponents(
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
  )
  .edit(cmd.channel.id, cmd.message.id);

 const payload = await closeChannel.call(this, cmd.guild, cmd.channel, ticket, user);
 payload.reply(cmd);
}

export const closeChannel = async function (
 this: TicketPlugin,
 guild: APIPartialInteractionGuild,
 channel: APIMessageComponentInteraction['channel'],
 ticket: PrismaTicket & { settings: PrismaTicketSettings },
 closer: APIUser,
): Promise<MessagePayload> {
 const isThread =
  channel.type === ChannelType.PublicThread ||
  channel.type === ChannelType.PrivateThread ||
  channel.type === ChannelType.AnnouncementThread;

 const api = await this.client.getAPI(guild.id);
 const t = await this.t(guild.id);

 api.channels.edit(
  channel.id,
  {
   archived: isThread ? false : undefined,
   auto_archive_duration: isThread ? ThreadAutoArchiveDuration.OneHour : undefined,
   name: `${t.closed()}-${channel?.name?.replace(t.claimed(), '')}`.slice(0, 30),
   parent_id:
    !isThread && [TicketType.Channel, TicketType.dmToChannel].includes(ticket.settings.type)
     ? ticket.settings.archiveCategory || undefined
     : undefined,
   permission_overwrites:
    !isThread &&
    [TicketType.Channel, TicketType.dmToChannel].includes(ticket.settings.type) &&
    !!ticket.settings.archiveCategory
     ? (
        await this.client.cache.channels.get(ticket.settings.archiveCategory)
       )?.permission_overwrites?.map((o) => ({
        id: o.id,
        type: o.type,
        allow: String(o.allow),
        deny: String(o.deny),
       })) || undefined
     : undefined,
  },
  { origin: this.name, reason: 'Closing ticket' },
 );

 if (channel && !isThread) {
  (channel as RChannel).permission_overwrites
   ?.filter((o) => o.type === OverwriteType.Member)
   .forEach((o) => {
    api.channels.deletePermissionOverwrite(channel.id, o.id, {
     origin: this.name,
     reason: 'Removing user permissions on ticket close',
    });
   });
 }

 if (channel && isThread) {
  const res = await api.threads.removeMember(channel.id, ticket.user, {
   origin: this.name,
   reason: 'Removing user from thread on ticket close',
  });

  if (res instanceof RequestHandlerError) return { reply: () => undefined } as never;
 }

 if (ticket) {
  handleLog.call(this, String(ticket.id), {
   type: LogType.TicketClosed,
   data: { user: closer },
  });
 }

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

 const payload: MessagePayload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Closing ticket',
 })
  .setEmbeds([
   {
    author: { name: `${emotes.tools.name} | ${t.SupportTeam()}` },
    description: getCloseReason(closer.bot || false, ticket.settings.type, t),
    color: Colors.Danger,
   },
  ])
  .setComponents([deleteBtn]);

 if (!ticket) return payload;
 if (!ticket.dm) return payload;

 const dmReason = 'Closing ticket DM';

 const dmPayload = new MessagePayload(this.client, {
  origin: this.name,
  reason: dmReason,
 })
  .setEmbeds([
   {
    author: { name: `${emotes.tools.name} | ${t.SupportTeam()}` },
    description: getCloseReason(closer.bot || false, ticket.settings.type, t),
    color: Colors.Danger,
   },
  ])
  .getAPIPayload();

 api.channels.createDirectMessage(ticket.dm, dmPayload, { origin: this.name, reason: dmReason });

 new Ticket(this.client, String(ticket.id)).update({ state: TicketState.closed }).then();

 const pins = await api.channels.getPins(ticket.dm, {
  origin: this.name,
  reason: 'Checking for pinned messages on ticket DM',
 });

 if (pins instanceof RequestHandlerError) return payload;

 const messages = pins.filter((m) => m.author_id !== ticket.user && (m.components?.length || 0));
 messages.forEach((m) =>
  api.channels.unpinDirectMessage(m.channel_id, m.id, {
   origin: this.name,
   reason: 'Unpinning messages on ticket DM close',
  }),
 );

 return payload;
};

const getCloseReason = function (
 isBot: boolean,
 type: TicketType,
 t: Awaited<ReturnType<TicketPlugin['t']>>,
) {
 if (isBot && [TicketType.dmToThread, TicketType.dmToChannel].includes(type)) {
  return t.hasClosedThreadInactiveRelay();
 }

 if (isBot) return t.hasClosedThreadInactive();

 if ([TicketType.dmToThread, TicketType.dmToChannel].includes(type)) {
  return t.hasClosedThreadRelay();
 }

 return t.hasClosedThread();
};
