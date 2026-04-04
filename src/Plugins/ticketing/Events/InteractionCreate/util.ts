import { RequestHandlerError } from '@ayako/api';
import {
 TicketLogMode,
 type Ticket as PrismaTicket,
 type TicketSetting as PrismaTicketSetting,
} from '@ayako/database';
import type { RChannel, RThread, RUser } from '@ayako/utility';
import { EmbedBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';

export enum LogType {
 TicketCreated = 'ticketCreated',
}

interface LogOpts<T extends LogType> {
 type: T;
 data: T extends LogType.TicketCreated ? { user: RUser; channel: RChannel | RThread } : never;
}

export const handleLog = async function <T extends LogType>(
 this: TicketPlugin,
 ticketId: string,
 logOpts: LogOpts<T>,
) {
 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket || !ticket.settings || !ticket.settings.logChannels.length) return;

 const logChannels = await getLogChannels.call(this, ticket).then((r) => r.filter((c) => !!c));
 const t = await this.t(ticket.settings.guild);
 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Creating log message',
 });

 switch (logOpts.type) {
  case LogType.TicketCreated: {
   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorCreate() })
     .setDescription(t.logs.descCreate({ user: logOpts.data.user, channel: logOpts.data.channel })),
   ]);
   break;
  }

  default:
   this.client.logger.warn(`[Plugin:${this.name}] Unknown log type:`, logOpts.type);
   break;
 }

 payload
  .setSendTo(logChannels.map((c) => ({ channel: c.id, guildId: ticket.settings.guild })))
  .send();
};

const createLogThread = async function (
 this: TicketPlugin,
 guildId: string,
 channelId: string,
 ticketId: string,
) {
 // TODO: replace with actual payload
 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Creating log thread message',
 }).setContent('This is a temporary placeholder');

 const channel = await this.client.cache.channels.get(channelId);
 if (!channel) return null;

 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket) return null;

 const api = await this.client.getAPI(guildId);

 if (ChannelType.GuildForum === channel.type || ChannelType.GuildMedia === channel.type) {
  const appliedTags = ticket.settings.appliedTags.map((name) => [
   channel.available_tags.find((at) => at.name === name)?.id,
   name,
  ]);

  const missingTags = appliedTags.filter(([id]) => !id);
  const existingTags = appliedTags.map(([id]) => id).filter((id): id is string => !!id);
  const missingTagEdit = missingTags.length
   ? await api.channels.edit(
      channelId,
      {
       available_tags: [
        ...channel.available_tags,
        ...missingTags.map(([, name]) => ({ name })).filter((n): n is { name: string } => !!n.name),
       ],
      },
      { origin: this.name, reason: 'Creating missing tags' },
     )
   : true;

  return api.channels
   .createForumThread(
    channelId,
    {
     name: `log-${ticketId}`,
     message: payload.getAPIPayload(),
     applied_tags:
      missingTagEdit instanceof RequestHandlerError
       ? existingTags
       : [...existingTags, ...missingTags.map(([id]) => id).filter((id): id is string => !!id)],
    },
    { origin: this.name, reason: 'Creating log thread' },
   )
   .then((r) => (r instanceof RequestHandlerError ? null : r));
 }

 return api.channels
  .createThread(channelId, { name: `log-${ticketId}`, type: ChannelType.PublicThread }, undefined, {
   origin: this.name,
   reason: 'Creating log thread',
  })
  .then((thread) => {
   if (thread instanceof RequestHandlerError) return null;

   api.channels.createMessage(thread.id, payload.getAPIPayload(), {
    origin: this.name,
    reason: 'Creating log thread message',
   });

   return thread;
  });
};

const getLogThread = async function (
 this: TicketPlugin,
 guildId: string,
 threadOrChannelId: string,
 ticketId: string,
) {
 const thread = await this.client.cache.threads.get(threadOrChannelId);
 if (thread) return thread;

 const existingThreads = await this.client.cache.threads.getAll(guildId, threadOrChannelId);
 if (!existingThreads) return createLogThread.call(this, guildId, threadOrChannelId, ticketId);

 const forumThreads = existingThreads.find((t) => t.name === `log-${ticketId}`);
 if (!forumThreads) return createLogThread.call(this, guildId, threadOrChannelId, ticketId);

 return forumThreads;
};

export const getLogChannels = async function (
 this: TicketPlugin,
 ticket: PrismaTicket & { settings: PrismaTicketSetting },
) {
 const logChannels = await Promise.all(
  ticket.settings.logChannels.map((logChannelId) => this.client.cache.channels.get(logChannelId)),
 );

 const logThreads = await Promise.all(
  logChannels
   .map((channel, i) => (!channel ? ticket.settings.logChannels[i] : channel.id))
   .filter((id): id is string => !!id)
   .map((id) => getLogThread.call(this, ticket.settings.guild, id, String(ticket.id))),
 );

 const textChannels = logChannels.filter(
  (c): c is RChannel =>
   !!c &&
   c.type !== ChannelType.GuildForum &&
   c.type !== ChannelType.GuildMedia &&
   c.type !== ChannelType.GuildCategory,
 );

 return [
  ...(ticket.settings.logMode === TicketLogMode.Channel
   ? textChannels
   : await Promise.all(
      textChannels.map((c) =>
       getLogThread.call(this, ticket.settings.guild, c.id, String(ticket.id)),
      ),
     )),
  ...logThreads,
 ];
};
