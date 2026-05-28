import { RequestHandlerError } from '@ayako/api';
import { TicketLogMode, type Ticket, type TicketSetting } from '@ayako/database';
import {
 LogLevel,
 txtFileWriter,
 type RChannel,
 type RMessage,
 type RThread,
} from '@ayako/utility';
import {
 ContainerBuilder,
 EmbedBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ChannelType,
 MessageFlags,
 SeparatorSpacingSize,
 type GatewayMessageDeleteDispatchData,
} from 'discord-api-types/v10';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import type Database from '../../../Classes/Database.js';
import { Colors } from '../../../Types/index.js';
import { cloneMessageIntoContainer } from '../../../Util/cloneMessageIntoContainer.js';
import fetchMessages from '../../../Util/fetchMessages.js';
import getUser from '../../../Util/getUser.js';
import languageFunctions from '../../../Util/languageFunctions.js';
import type TicketPlugin from '../Plugin.js';
import { BaseTicketLoggerErrors } from './Enums.js';

export enum LogType {
 TicketCreated = 'ticketCreated',
 TicketClaimed = 'ticketClaimed',
 TicketClosed = 'ticketClosed',
 TicketLeft = 'ticketLeft',
 TicketDeleted = 'ticketDeleted',
 MessageSent = 'messageSent',
 MessageEdited = 'messageEdited',
 MessageDeleted = 'messageDeleted',
}

export interface LogOpts<T extends LogType> {
 type: T;
 data: T extends LogType.MessageSent | LogType.MessageEdited | LogType.MessageDeleted
  ? MessageLogData
  : DefaultLogData;
}

interface DefaultLogData {
 userId: string;
}

interface MessageLogData {
 userId: string;
 message: GatewayMessageDeleteDispatchData | RMessage | null;
}

export default abstract class BaseTicketLogger {
 client: Client;
 plugin: TicketPlugin;
 id: string;

 db: Database['client'];
 dbTicket: (Ticket & { settings: TicketSetting }) | null = null;

 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  this.client = client;
  this.id = ticketId;
  this.db = this.client.db.client;
  this.plugin = plugin;
 }

 getTicket = async () => {
  if (this.dbTicket) return this.dbTicket;
  return this.refreshDbTicket();
 };

 refreshDbTicket = async () => {
  this.plugin.logger.logLocation(LogLevel.silly);
  this.dbTicket = await this.db.ticket.findUnique({
   where: { id: this.id },
   include: { settings: true },
  });
  if (!this.dbTicket) throw new Error(BaseTicketLoggerErrors.ticketNotFound);
  return this.dbTicket;
 };

 async getUser(userId: string) {
  if (!this.client) {
   throw new Error(
    '[BaseTicketLogger] getUser called without client — receiver is ' + this?.constructor?.name,
   );
  }

  const user = await getUser.call(this.client, userId);
  if (user instanceof RequestHandlerError) {
   this.plugin.logger.logLocation(LogLevel.warn);
   this.plugin.nonFatalError(
    new Error(BaseTicketLoggerErrors.userNotFound, { cause: user }),
    this.getUser.name,
   );
   return null;
  }
  return user;
 }

 async ticketCreateLog(
  payload: MessagePayload,
  logOpts: LogOpts<LogType.TicketCreated>,
  channel: RChannel | null,
  ticketChannel: RChannel | RThread | null,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorCreate() })
    .setColor(Colors.Success)
    .setDescription(
     t.logs.descCreate({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);
 }

 async ticketClaimLog(
  payload: MessagePayload,
  logOpts: LogOpts<LogType.TicketClaimed>,
  channel: RChannel | null,
  ticketChannel: RChannel | RThread | null,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorClaimed() })
    .setColor(Colors.Base)
    .setDescription(
     t.logs.descClaimed({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);
 }

 async ticketClosedLog(
  payload: MessagePayload,
  logOpts: LogOpts<LogType.TicketClosed>,
  channel: RChannel | null,
  ticketChannel: RChannel | RThread | null,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorClosed() })
    .setColor(Colors.Base)
    .setDescription(
     t.logs.descClosed({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);
 }

 async ticketLeftLog(
  payload: MessagePayload,
  logOpts: LogOpts<LogType.TicketLeft>,
  channel: RChannel | null,
  ticketChannel: RChannel | RThread | null,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorLeft() })
    .setColor(Colors.Base)
    .setDescription(
     t.logs.descLeft({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);
 }

 async ticketDeletedLog(
  payload: MessagePayload,
  logOpts: LogOpts<LogType.TicketDeleted>,
  channel: RChannel | null,
  ticketChannel: RChannel | RThread | null,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const transcript = ticketChannel ? await this.getTranscript(ticketChannel) : null;

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorDeleted() })
    .setColor(Colors.Base)
    .setDescription(
     t.logs.descDeleted({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);

  if (transcript) payload.setFiles([txtFileWriter(transcript)]);
 }

 async messageSentLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageSent>) {
  const { message } = logOpts.data;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const container = this.createMessageContainer(
   t.logs.authorMessageSentForwarded({
    user: lF.getUser(await this.getUser(logOpts.data.userId)),
    url: constants.formatters.msgURL(
     message?.guild_id || '@me',
     message?.channel_id || '',
     message?.id || '',
    ),
   }),
  );

  container.setAccentColor(Colors.Success);
  cloneMessageIntoContainer.call(container, message);
  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async messageEditedLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageEdited>) {
  const { message } = logOpts.data;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const container = this.createMessageContainer(
   t.logs.authorMessageEditedForwarded({
    user: lF.getUser(await this.getUser(logOpts.data.userId)),
    url: constants.formatters.msgURL(
     message?.guild_id || '@me',
     message?.channel_id || '',
     message?.id || '',
    ),
   }),
  );

  container.setAccentColor(Colors.Base);
  cloneMessageIntoContainer.call(container, message);
  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async messageDeletedLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageDeleted>) {
  const { message } = logOpts.data;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const container = this.createMessageContainer(
   t.logs.authorMessageDeletedForwarded({
    user: lF.getUser(await this.getUser(logOpts.data.userId)),
    url: constants.formatters.msgURL(
     message?.guild_id || '@me',
     message?.channel_id || '',
     message?.id || '',
    ),
   }),
  );

  container.setAccentColor(Colors.Success);
  cloneMessageIntoContainer.call(container, message);
  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async handleBaseLog<T extends LogType>(logOpts: LogOpts<T>) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const ticket = await this.getTicket();
  if (!ticket.settings.logChannels.length) {
   this.plugin.logger.logLocation(LogLevel.silly);
   return;
  }

  const logChannels = await this.getLogChannels().then((r) => r.filter((c) => !!c));

  const channel = await this.client.cache.channels.get(ticket.channel);
  const ticketChannel =
   (await this.client.cache.channels.get(ticket.channel)) ||
   (await this.client.cache.threads.get(ticket.channel));

  const payload = new MessagePayload(this.client, {
   origin: BaseTicketLogger.name,
   reason: 'Creating log message',
  });

  if ('message' in logOpts.data && logOpts.data.message && 'content' in logOpts.data.message) {
   logOpts.data.message.content = this.removeSendMessagePrefixes(
    logOpts.data.message.content,
    ticket.settings.sendMessagePrefixes,
   );
  }

  switch (logOpts.type) {
   case LogType.TicketCreated:
    await this.ticketCreateLog(
     payload,
     logOpts as LogOpts<LogType.TicketCreated>,
     channel,
     ticketChannel,
    );
    break;
   case LogType.TicketClaimed:
    await this.ticketClaimLog(
     payload,
     logOpts as LogOpts<LogType.TicketClaimed>,
     channel,
     ticketChannel,
    );
    break;
   case LogType.TicketClosed:
    await this.ticketClosedLog(
     payload,
     logOpts as LogOpts<LogType.TicketClosed>,
     channel,
     ticketChannel,
    );
    break;
   case LogType.TicketLeft:
    await this.ticketLeftLog(
     payload,
     logOpts as LogOpts<LogType.TicketLeft>,
     channel,
     ticketChannel,
    );
    break;
   case LogType.TicketDeleted:
    await this.ticketDeletedLog(
     payload,
     logOpts as LogOpts<LogType.TicketDeleted>,
     channel,
     ticketChannel,
    );
    break;
   case LogType.MessageSent:
    await this.messageSentLog(payload, logOpts as LogOpts<LogType.MessageSent>);
    break;
   case LogType.MessageEdited:
    await this.messageEditedLog(payload, logOpts as LogOpts<LogType.MessageEdited>);
    break;
   case LogType.MessageDeleted:
    await this.messageDeletedLog(payload, logOpts as LogOpts<LogType.MessageDeleted>);
    break;

   default: {
    this.plugin.nonFatalError(
     new Error(`Unknown log type: ${logOpts.type}`),
     this.handleBaseLog.name,
    );
    break;
   }
  }

  this.plugin.logger.logLocation(LogLevel.debug);

  payload
   .setSendTo(
    [...new Set(logChannels.map((c) => c.id))].map((c) => ({
     channel: logChannels.find((lc) => lc.id === c)!.id,
     guildId: ticket.settings.guild,
    })),
   )
   .send();

  return true;
 }

 async getLogChannels() {
  const ticket = await this.getTicket();

  const logChannels = await Promise.all(
   ticket.settings.logChannels.map((logChannelId) => this.client.cache.channels.get(logChannelId)),
  );

  const logThreads = await Promise.all(
   logChannels
    .map((channel, i) => (!channel ? ticket.settings.logChannels[i] : channel.id))
    .filter((id): id is string => !!id)
    .map((id) => this.getLogThread(id)),
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
    : await Promise.all(textChannels.map((c) => this.getLogThread(c.id)))),
   ...logThreads,
  ];
 }

 async getLogThread(threadOrChannelId: string) {
  const ticket = await this.getTicket();
  const thread = await this.client.cache.threads.get(threadOrChannelId);
  if (thread) return thread;

  const existingThreads = await this.client.cache.threads.getAll(
   ticket.settings.guild,
   threadOrChannelId,
  );
  if (!existingThreads) return this.createLogThread(threadOrChannelId);

  const forumThreads = existingThreads.find((t) => t.name === `log-${ticket.id}`);
  if (!forumThreads) return this.createLogThread(threadOrChannelId);

  return forumThreads;
 }

 async createLogThread(channelId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();

  const t = await this.plugin.t(ticket.settings.guild);

  // TODO: replace with actual payload
  const payload = new MessagePayload(this.client, {
   origin: BaseTicketLogger.name,
   reason: 'Creating log thread message 1',
  })
   .setContent('This is a temporary placeholder')
   .setEmbeds([
    {
     author: { name: t.ticketSystem() },
     description: ticket.settings.sendMessagePrefixes.length
      ? t.logs.logExplain()
      : t.logs.logExplainAll(),
     color: Colors.Ephemeral,
     fields: ticket.settings.sendMessagePrefixes.length
      ? [
         {
          name: t.replyWith(),
          value: ticket.settings.sendMessagePrefixes.map((p) => `\`${p}\``).join(', '),
         },
        ]
      : [],
    },
   ]);

  const channel = await this.client.cache.channels.get(channelId);
  if (!channel) return null;

  const api = await this.client.getAPI(ticket.settings.guild);

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
         ...missingTags
          .map(([, name]) => ({ name }))
          .filter((n): n is { name: string } => !!n.name),
        ],
       },
       { origin: BaseTicketLogger.name, reason: 'Creating missing tags' },
      )
    : true;

   return api.channels
    .createForumThread(
     channelId,
     {
      name: `log-${ticket.id}`,
      message: payload.getAPIPayload(),
      applied_tags:
       missingTagEdit instanceof RequestHandlerError
        ? existingTags
        : [...existingTags, ...missingTags.map(([id]) => id).filter((id): id is string => !!id)],
     },
     { origin: BaseTicketLogger.name, reason: 'Creating log thread' },
    )
    .then((r) => (r instanceof RequestHandlerError ? null : r));
  }

  return api.channels
   .createThread(
    channelId,
    { name: `log-${ticket.id}`, type: ChannelType.PublicThread },
    undefined,
    {
     origin: BaseTicketLogger.name,
     reason: 'Creating log thread',
    },
   )
   .then((thread) => {
    if (thread instanceof RequestHandlerError) return null;

    api.channels.createMessage(thread.id, payload.getAPIPayload(), {
     origin: BaseTicketLogger.name,
     reason: 'Creating log thread message 2',
    });

    return thread;
   });
 }

 removeSendMessagePrefixes(content: string, prefixes: string[]) {
  return content.replace(new RegExp(`^(${prefixes.join('|')})`), '').trim();
 }

 async getTranscript(channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.debug);
  const messages = await fetchMessages.call(
   this.client,
   channel.id,
   channel.guild_id,
   { amount: 1000 },
   { origin: BaseTicketLogger.name, reason: 'Fetching messages for transcript' },
  );

  const t = await this.plugin.t(channel.guild_id);

  return messages
   .map((m, i) => {
    if (m.embeds[0]?.author?.name && m.embeds[0]?.description) {
     return `${m.embeds[0]?.author?.name}: ${m.embeds[0]?.description}${i === 0 ? '\n' : ''}`;
    }
    return `${'user' in m ? m.user?.username : t.base.t.Unknown()}: ${m.content}`;
   })
   .reverse()
   .join('\n');
 }

 createMessageContainer(authorName: string) {
  return new ContainerBuilder()
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${authorName}`))
   .addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
   );
 }

 messageSent(msg: RMessage, internal: boolean = false) {
  // TODO: handle internal
  this.handleBaseLog({ type: LogType.MessageSent, data: { userId: msg.author_id, message: msg } });
 }

 messageEdited(msg: RMessage, internal: boolean = false) {
  // TODO: handle internal
  this.handleBaseLog({
   type: LogType.MessageEdited,
   data: { userId: msg.author_id, message: msg },
  });
 }

 messageDeleted(msg: RMessage, internal: boolean = false) {
  // TODO: handle internal
  this.handleBaseLog({
   type: LogType.MessageDeleted,
   data: { userId: msg.author_id, message: msg },
  });
 }
}
