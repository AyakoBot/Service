import { RequestHandlerError } from '@ayako/api';
import { TicketLogMode, type Prisma, type Ticket, type TicketSetting } from '@ayako/database';
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
import getUser from '../../../Util/getUser.js';
import languageFunctions from '../../../Util/languageFunctions.js';
import type TicketPlugin from '../Plugin.js';
import {
 encodeContext,
 extractBody,
 findContext,
 hasActionButton,
 TicketContextType,
} from '../Util/transcriptContext.js';

import { BaseTicketLoggerErrors, TicketThreadPrefix } from './Enums.js';

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

export enum LogType {
 TicketCreated = 'ticketCreated',
 TicketClaimed = 'ticketClaimed',
 TicketClosed = 'ticketClosed',
 TicketLeft = 'ticketLeft',
 TicketDeleted = 'ticketDeleted',
 TicketDeletedUnusual = 'ticketDeletedUnusual',
 MessageSent = 'messageSent',
 MessageEdited = 'messageEdited',
 MessageDeleted = 'messageDeleted',
 MessageInternal = 'messageInternal',
}

export interface LogOpts<T extends LogType> {
 type: T;
 data: T extends
  | LogType.MessageSent
  | LogType.MessageEdited
  | LogType.MessageDeleted
  | LogType.MessageInternal
  ? MessageLogData
  : T extends LogType.TicketClosed
    ? ClosedLogData
    : DefaultLogData;
}

interface DefaultLogData {
 userId: string;
}

interface ClosedLogData {
 userId: string;
 reason?: string;
}

interface MessageLogData {
 userId: string;
 message: GatewayMessageDeleteDispatchData | RMessage | null;
 forwarded?: boolean;
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

 getTicket = async (): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> => {
  if (this.dbTicket) return this.dbTicket;
  return this.refreshDbTicket();
 };

 refreshDbTicket = async (): Promise<Prisma.TicketGetPayload<{ include: { settings: true } }>> => {
  this.plugin.logger.logLocation(LogLevel.silly);
  this.dbTicket = await this.db.ticket.findUnique({
   where: { id: this.id },
   include: { settings: true },
  });
  if (!this.dbTicket) throw new Error(BaseTicketLoggerErrors.ticketNotFound);
  return this.dbTicket;
 };

 async getUser(userId: string) {
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
    .setColor(Colors.Info)
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

  const embed = new EmbedBuilder()
   .setAuthor({ name: t.logs.authorClosed() })
   .setColor(Colors.Warning)
   .setDescription(
    t.logs.descClosed({
     user: lF.getUser(await this.getUser(logOpts.data.userId)),
     channel: lF.getChannel(channel),
     ticket: lF.getChannel(ticketChannel),
    }),
   );

  if (logOpts.data.reason) {
   embed.addFields({ name: t.base.t.Reason(), value: logOpts.data.reason });
  }

  payload.setEmbeds([embed]);
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
    .setColor(Colors.Warning)
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

  const transcript = await this.getTranscript(ticket.channel, ticket.settings.guild);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorDeleted() })
    .setColor(Colors.Danger)
    .setDescription(
     t.logs.descDeleted({
      user: lF.getUser(await this.getUser(logOpts.data.userId)),
      channel: lF.getChannel(channel),
      ticket: lF.getChannel(ticketChannel),
     }),
    ),
  ]);

  if (transcript) payload.setFiles([txtFileWriter(transcript, t.base.t.Transcript())]);
 }

 async ticketDeletedUnusualLog(
  payload: MessagePayload,
  _logOpts: LogOpts<LogType.TicketDeletedUnusual>,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);

  const transcript = await this.getTranscript(ticket.channel, ticket.settings.guild);

  payload.setEmbeds([
   new EmbedBuilder()
    .setAuthor({ name: t.logs.authorDeletedUnusual() })
    .setColor(Colors.Danger)
    .setDescription(t.logs.descDeletedUnusual({ channel: `<#${ticket.channel}>` })),
  ]);

  if (transcript) payload.setFiles([txtFileWriter(transcript, t.base.t.Transcript())]);
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

 async messageInternalLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageInternal>) {
  const container = await this.buildInternalNoteContainer(
   logOpts.data.message,
   logOpts.data.userId,
   false,
  );
  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async buildInternalNoteContainer(
  message: GatewayMessageDeleteDispatchData | RMessage | null,
  userId: string,
  withContext: boolean,
 ) {
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const authorName = t.logs.authorMessageInternal({
   user: lF.getUser(await this.getUser(userId)),
   url: constants.formatters.msgURL(
    message?.guild_id || '@me',
    message?.channel_id || '',
    message?.id || '',
   ),
  });

  const context = withContext
   ? encodeContext(TicketContextType.Internal, userId, message?.id || '0')
   : undefined;

  const container = new ContainerBuilder();
  cloneMessageIntoContainer.call(
   container,
   message,
   context ? { authorName, rawAuthor: true, context } : { authorName, rawAuthor: true },
  );

  return container;
 }

 async messageEditedLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageEdited>) {
  const { message, forwarded } = logOpts.data;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const authorFn = forwarded
   ? t.logs.authorMessageEditedForwarded
   : t.logs.authorMessageEditedInternal;
  const authorName = authorFn({
   user: lF.getUser(await this.getUser(logOpts.data.userId)),
   url: constants.formatters.msgURL(
    message?.guild_id || '@me',
    message?.channel_id || '',
    message?.id || '',
   ),
  });

  const container = this.createMessageContainer(authorName).setAccentColor(Colors.Loading);
  cloneMessageIntoContainer.call(container, message);

  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async messageDeletedLog(payload: MessagePayload, logOpts: LogOpts<LogType.MessageDeleted>) {
  const { message, forwarded } = logOpts.data;
  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const lF = languageFunctions(t.base);

  const authorFn = forwarded
   ? t.logs.authorMessageDeletedForwarded
   : t.logs.authorMessageDeletedInternal;
  const authorName = authorFn({
   user: lF.getUser(await this.getUser(logOpts.data.userId)),
   url: constants.formatters.msgURL(
    message?.guild_id || '@me',
    message?.channel_id || '',
    message?.id || '',
   ),
  });

  const container = this.createMessageContainer(authorName).setAccentColor(Colors.Danger);
  cloneMessageIntoContainer.call(container, message);

  payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);
 }

 async handleBaseLog<T extends LogType>(logOpts: LogOpts<T>) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const ticket = await this.getTicket();
  const transcriptChannels =
   logOpts.type === LogType.TicketDeleted || logOpts.type === LogType.TicketDeletedUnusual
    ? ticket.settings.transcriptChannels
    : [];

  if (!ticket.settings.logChannels.length && !transcriptChannels.length) {
   this.plugin.logger.logLocation(LogLevel.silly);
   return;
  }

  const logChannels = await this.getLogChannels().then((r) => r.filter((c) => !!c));

  const channel = await this.client.cache.channels.get(ticket.settings.channel || '');
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
   case LogType.TicketDeletedUnusual:
    await this.ticketDeletedUnusualLog(payload, logOpts as LogOpts<LogType.TicketDeletedUnusual>);
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
   case LogType.MessageInternal:
    await this.messageInternalLog(payload, logOpts as LogOpts<LogType.MessageInternal>);
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

  const targets = [...new Set([...logChannels.map((c) => c.id), ...transcriptChannels])];

  payload
   .setAPI(await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken))
   .setSendTo(targets.map((channel) => ({ channel, guildId: ticket.settings.guild })))
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

  const forumThreads = existingThreads.find(
   (t) => t.name === `${TicketThreadPrefix.Log}${ticket.id}`,
  );
  if (!forumThreads) return this.createLogThread(threadOrChannelId);

  return forumThreads;
 }

 async createLogThread(channelId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const hasPrefixes = !!ticket.settings.sendMessagePrefixes.length;

  const payload = new MessagePayload(this.client, {
   origin: BaseTicketLogger.name,
   reason: 'Creating log thread message',
  })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    new ContainerBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**${t.ticketSystem()}**\n${hasPrefixes ? t.logs.logExplain() : t.logs.logExplainAll()}`,
      ),
     )
     .toJSON(),
    ...(hasPrefixes
     ? [this.buildReplyPrefixContainer(t.replyWith(), ticket.settings.sendMessagePrefixes)]
     : []),
   ]);

  return this.createNamedThread(
   channelId,
   `${TicketThreadPrefix.Log}${ticket.id}`,
   ChannelType.PublicThread,
   payload,
  );
 }

 buildReplyPrefixContainer(label: string, prefixes: string[]) {
  return new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `**${label}**\n${prefixes.map((p) => `\`${p}\``).join(', ')}`,
    ),
   )
   .toJSON();
 }

 async createNamedThread(
  channelId: string,
  name: string,
  threadType: ChannelType.PublicThread | ChannelType.PrivateThread,
  payload: MessagePayload,
 ): Promise<RThread | null> {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const channel = await this.client.cache.channels.get(channelId);
  if (!channel) return null;

  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  if (ChannelType.GuildForum === channel.type || ChannelType.GuildMedia === channel.type) {
   const idByName = await this.ensureForumTags(channel, ticket.settings.createTags);
   const appliedTags = ticket.settings.createTags
    .map((tagName) => idByName.get(tagName.slice(0, 20)))
    .filter((id): id is string => !!id)
    .slice(0, 5);

   return api.channels
    .createForumThread(
     channelId,
     { name, message: payload.getAPIPayload(), applied_tags: appliedTags },
     { origin: BaseTicketLogger.name, reason: 'Creating named thread' },
    )
    .then((r) => (r instanceof RequestHandlerError ? null : r));
  }

  return api.channels
   .createThread(channelId, { name, type: threadType }, undefined, {
    origin: BaseTicketLogger.name,
    reason: 'Creating named thread',
   })
   .then(async (thread) => {
    if (thread instanceof RequestHandlerError) return null;

    const msg = await api.channels.createMessage(thread.id, payload.getAPIPayload(), {
     origin: BaseTicketLogger.name,
     reason: 'Creating named thread message',
    });

    if (msg && !(msg instanceof RequestHandlerError)) {
     const pin = await api.channels.pinMessage(thread.id, msg.id, {
      origin: BaseTicketLogger.name,
      reason: 'Pinning thread intro message',
     });
     if (pin instanceof RequestHandlerError) {
      this.plugin.nonFatalError(pin, this.createNamedThread.name);
     }
    }

    return thread;
   });
 }

 async ensureForumTags(forum: RChannel, tagNames: string[]): Promise<Map<string, string>> {
  if (forum.type !== ChannelType.GuildForum && forum.type !== ChannelType.GuildMedia) {
   return new Map();
  }

  const trunc = (s: string) => s.slice(0, 20);
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  const current = forum.available_tags;
  const byName = new Map(current.map((at) => [at.name, at]));

  const room = Math.max(0, 20 - current.length);
  const toCreate = [...new Set(tagNames.map(trunc))]
   .filter((n) => n.length && !byName.has(n))
   .slice(0, room);

  const allNames = [...current.map((at) => at.name), ...toCreate];
  const priority = [
   ...new Set(
    [...ticket.settings.createTags, ...ticket.settings.claimTags, ...ticket.settings.closeTags].map(
     trunc,
    ),
   ),
  ].filter((n) => allNames.includes(n));
  const prioritySet = new Set(priority);
  const rest = allNames.filter((n) => !prioritySet.has(n));

  const desired = [...priority, ...rest].map((name) => byName.get(name) ?? { name });

  let availableTags = current;
  const currentNames = current.map((at) => at.name);
  const desiredNames = desired.map((entry) => entry.name);
  const changed =
   desiredNames.length !== currentNames.length ||
   desiredNames.some((name, i) => name !== currentNames[i]);

  if (changed) {
   const edited = await api.channels.edit(
    forum.id,
    { available_tags: desired },
    { origin: BaseTicketLogger.name, reason: 'Ensuring and ordering forum tags' },
   );
   if (edited && !(edited instanceof RequestHandlerError) && 'available_tags' in edited) {
    availableTags = edited.available_tags;
   }
  }

  return new Map(availableTags.map((at) => [at.name, at.id]));
 }

 async retagForumPost(
  forum: RChannel,
  postId: string,
  stepTagNames: string[],
  extraTagNames: string[],
 ) {
  const trunc = (s: string) => s.slice(0, 20);
  const ticket = await this.getTicket();
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  const post = await this.client.cache.threads.get(postId);
  const currentApplied = post?.applied_tags ?? [];

  const idByName = await this.ensureForumTags(forum, [...stepTagNames, ...extraTagNames]);
  if (!idByName.size) return;

  const resolve = (names: string[]) =>
   names.map((n) => idByName.get(trunc(n))).filter((id): id is string => !!id);

  const stepIds = resolve(stepTagNames);
  const extraIds = resolve(extraTagNames);

  const managedNames = new Set(
   [...ticket.settings.createTags, ...ticket.settings.claimTags, ...ticket.settings.closeTags].map(
    trunc,
   ),
  );
  const managedIds = new Set(
   [...idByName.entries()].filter(([name]) => managedNames.has(name)).map(([, id]) => id),
  );

  const preserved = currentApplied.filter((id) => !managedIds.has(id));
  const newApplied = [...new Set([...stepIds, ...extraIds, ...preserved])].slice(0, 5);

  const res = await api.channels.edit(
   postId,
   { applied_tags: newApplied },
   { origin: BaseTicketLogger.name, reason: 'Retagging ticket forum post' },
  );
  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, this.retagForumPost.name);
  }
 }

 isForumChannel(channel: RChannel | null | undefined): channel is RChannel {
  return (
   !!channel && (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia)
  );
 }

 async getForumLogTargets(): Promise<{ forum: RChannel; postId: string }[]> {
  const ticket = await this.getTicket();

  const resolved = await Promise.all(
   ticket.settings.logChannels.map(
    async (channelId): Promise<{ forum: RChannel; postId: string } | null> => {
     const channel = await this.client.cache.channels.get(channelId);
     if (!this.isForumChannel(channel)) return null;

     const post = await this.getLogThread(channelId);
     return post ? { forum: channel, postId: post.id } : null;
    },
   ),
  );

  return resolved.filter((t): t is { forum: RChannel; postId: string } => !!t);
 }

 async getForumStaffTarget(): Promise<{ forum: RChannel; postId: string } | null> {
  const postId = await this.getStaffThreadId();
  if (!postId) return null;

  const post = await this.client.cache.threads.get(postId);
  if (!post?.parent_id) return null;

  const forum = await this.client.cache.channels.get(post.parent_id);
  if (!this.isForumChannel(forum)) return null;

  return { forum, postId };
 }

 async getForumTicketTarget(): Promise<{ forum: RChannel; postId: string } | null> {
  const ticket = await this.getTicket();

  const post = await this.client.cache.threads.get(ticket.channel);
  if (!post?.parent_id) return null;

  const forum = await this.client.cache.channels.get(post.parent_id);
  if (!this.isForumChannel(forum)) return null;

  return { forum, postId: ticket.channel };
 }

 async applyLifecycleTags(stepTagNames: string[], claimerName?: string | null) {
  const extra = claimerName ? [claimerName] : [];

  const logTargets = await this.getForumLogTargets();
  const staffTarget = await this.getForumStaffTarget();
  const ticketTarget = await this.getForumTicketTarget();
  const targets = [
   ...logTargets,
   ...(staffTarget ? [staffTarget] : []),
   ...(ticketTarget ? [ticketTarget] : []),
  ];

  await Promise.all(
   targets.map((target) => this.retagForumPost(target.forum, target.postId, stepTagNames, extra)),
  );
 }

 async getStaffThreadId(): Promise<string | null> {
  return null;
 }

 removeSendMessagePrefixes(content: string, prefixes: string[]) {
  return content.replace(new RegExp(`^(${prefixes.join('|')})`), '').trim();
 }

 async getTranscript(channelId: string, guildId: string) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const t = await this.plugin.t(guildId);
  const messages = await this.client.cache.messages.getAllLatest(guildId, channelId);

  const staffThreadId = await this.getStaffThreadId();
  const staffMessages = staffThreadId
   ? await this.client.cache.messages.getAllLatest(guildId, staffThreadId)
   : [];

  const tagged = [
   ...messages.map((m) => ({ m, internal: false })),
   ...staffMessages.map((m) => ({ m, internal: true })),
  ].sort((a, b) => (BigInt(a.m.id) < BigInt(b.m.id) ? -1 : 1));

  const creator = await this.client.cache.users.get(ticket.user);
  const created = `[${t.base.t.Created()}] ${creator?.username || t.base.t.Unknown()}`;

  const rendered = await Promise.all(
   tagged.map(({ m, internal }) => this.transcriptLine(m, internal, t)),
  );

  return [created, ...rendered.filter((line): line is string => !!line)].join('\n');
 }

 async transcriptLine(m: RMessage, internal: boolean, t: Translator): Promise<string | null> {
  const prefix = internal ? `[${t.base.t.Internal()}] ` : '';
  const context = findContext(m.components);

  if (context) {
   const actor = await this.client.cache.users.get(context.actorId);
   const name = actor?.username || t.base.t.Unknown();
   const label = this.transcriptLabel(context.type, t);
   const body = extractBody(m.components) || this.embedReason(m, t);

   return body ? `${prefix}[${label}] ${name}: ${body}` : `${prefix}[${label}] ${name}`;
  }

  if (hasActionButton(m.components, ['tickets/', 'info/'])) return null;

  if (m.embeds?.[0]?.author?.name && m.embeds[0].description) {
   return `${prefix}${m.embeds[0].author.name}: ${m.embeds[0].description}`;
  }

  if (m.content) {
   const user = await this.client.cache.users.get(m.author_id);
   return `${prefix}${user?.username || t.base.t.Unknown()}: ${m.content}`;
  }

  return null;
 }

 transcriptLabel(type: TicketContextType, t: Translator): string {
  switch (type) {
   case TicketContextType.Created:
    return t.base.t.Created();
   case TicketContextType.Forwarded:
    return t.base.t.Forwarded();
   case TicketContextType.Internal:
    return t.base.t.Internal();
   case TicketContextType.Claimed:
    return t.base.t.Claimed();
   case TicketContextType.Unclaimed:
    return t.base.t.Unclaimed();
   case TicketContextType.Closed:
    return t.base.t.Closed();
   case TicketContextType.Left:
    return t.base.t.Left();
   case TicketContextType.Escalated:
    return t.base.t.Escalated();
   default:
    return type;
  }
 }

 embedReason(m: RMessage, t: Translator): string {
  const field = m.embeds?.[0]?.fields?.find((f) => f.name === t.base.t.Reason());
  return field?.value || '';
 }

 createMessageContainer(authorName: string) {
  return new ContainerBuilder()
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${authorName}`))
   .addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
   );
 }

 messageSent(msg: RMessage, internal: boolean = false) {
  this.handleBaseLog({
   type: internal ? LogType.MessageInternal : LogType.MessageSent,
   data: { userId: msg.author_id, message: msg },
  });
 }

 messageEdited(msg: RMessage, internal: boolean = false, forwarded: boolean = false) {
  this.handleBaseLog({
   type: internal ? LogType.MessageInternal : LogType.MessageEdited,
   data: { userId: msg.author_id, message: msg, forwarded },
  });
 }

 messageDeleted(msg: RMessage | null, internal: boolean = false, forwarded: boolean = false) {
  this.handleBaseLog({
   type: internal ? LogType.MessageInternal : LogType.MessageDeleted,
   data: { userId: msg?.author_id || '', message: msg, forwarded },
  });
 }
}
