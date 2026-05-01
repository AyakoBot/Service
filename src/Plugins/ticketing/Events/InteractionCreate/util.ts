import { RequestHandlerError } from '@ayako/api';
import {
 TicketLogMode,
 type Ticket as PrismaTicket,
 type TicketSetting as PrismaTicketSetting,
} from '@ayako/database';
import {
 txtFileWriter,
 type RChannel,
 type RMessage,
 type RThread,
 type RUser,
} from '@ayako/utility';
import {
 ButtonBuilder,
 ContainerBuilder,
 EmbedBuilder,
 FileBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 MessageFlags,
 SeparatorSpacingSize,
 StickerFormatType,
 type APIUser,
 type GatewayMessageDeleteDispatchData,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import fetchMessages from '../../../../Util/fetchMessages.js';
import languageFunctions from '../../../../Util/languageFunctions.js';
import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';
import { removeSendMessagePrefixes } from '../MessageUpdate/util.js';

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

interface LogOpts<T extends LogType> {
 type: T;
 data: T extends LogType.MessageSent | LogType.MessageEdited | LogType.MessageDeleted
  ? MessageLogData
  : DefaultLogData;
}

interface DefaultLogData {
 user: RUser | APIUser;
}

interface MessageLogData {
 user: RUser | APIUser | null;
 message: RMessage | GatewayMessageDeleteDispatchData | null;
}

export const handleLog = async function <T extends LogType>(
 this: TicketPlugin,
 ticketId: string,
 logOpts: LogOpts<T>,
) {
 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket || !ticket.settings || !ticket.settings.logChannels.length) return { debug: 1 };

 const channel = await this.client.cache.channels.get(ticket.channel);
 const ticketChannel =
  (await this.client.cache.channels.get(ticket.channel)) ||
  (await this.client.cache.threads.get(ticket.channel));

 const logChannels = await getLogChannels.call(this, ticket).then((r) => r.filter((c) => !!c));
 const t = await this.t(ticket.settings.guild);
 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Creating log message',
 });

 const lF = languageFunctions(t.base);

 if ('message' in logOpts.data && logOpts.data.message && 'content' in logOpts.data.message) {
  logOpts.data.message.content = removeSendMessagePrefixes(
   logOpts.data.message.content,
   ticket.settings.sendMessagePrefixes,
  );
 }

 switch (logOpts.type) {
  case LogType.TicketCreated: {
   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorCreate() })
     .setColor(Colors.Success)
     .setDescription(
      t.logs.descCreate({
       user: lF.getUser(logOpts.data.user),
       channel: lF.getChannel(channel),
       ticket: lF.getChannel(ticketChannel),
      }),
     ),
   ]);
   break;
  }

  case LogType.TicketClaimed: {
   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorClaimed() })
     .setColor(Colors.Base)
     .setDescription(
      t.logs.descClaimed({
       user: lF.getUser(logOpts.data.user),
       channel: lF.getChannel(channel),
       ticket: lF.getChannel(ticketChannel),
      }),
     ),
   ]);
   break;
  }

  case LogType.TicketClosed: {
   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorClosed() })
     .setDescription(
      t.logs.descClosed({
       user: lF.getUser(logOpts.data.user),
       channel: lF.getChannel(channel),
       ticket: lF.getChannel(ticketChannel),
      }),
     )
     .setColor(Colors.Danger),
   ]);
   break;
  }

  case LogType.TicketLeft: {
   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorLeft() })
     .setDescription(
      t.logs.descLeft({
       user: lF.getUser(logOpts.data.user),
       channel: lF.getChannel(channel),
       ticket: lF.getChannel(ticketChannel),
      }),
     )
     .setColor(Colors.Danger),
   ]);
   break;
  }

  case LogType.TicketDeleted: {
   const transcript = ticketChannel ? await getTranscript.call(this, ticketChannel) : null;

   payload.setEmbeds([
    new EmbedBuilder()
     .setAuthor({ name: t.logs.authorDeleted() })
     .setDescription(
      t.logs.descDeleted({
       user: lF.getUser(logOpts.data.user),
       ticket: lF.getChannel(ticketChannel),
       channel: lF.getChannel(channel),
      }),
     )
     .setColor(Colors.Danger),
   ]);

   if (transcript) payload.setFiles([txtFileWriter(transcript)]);
   break;
  }

  case LogType.MessageSent: {
   const { message: msg } = logOpts.data as MessageLogData;

   const container = createMessageContainer(
    t.logs.authorMessageSentForwarded({
     user: lF.getUser(logOpts.data.user),
     url: constants.formatters.msgURL(msg?.guild_id || '@me', msg?.channel_id || '', msg?.id || ''),
    }),
   );

   container.setAccentColor(Colors.Success);
   cloneMessageIntoContainer.call(container, msg);
   payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);

   break;
  }

  case LogType.MessageDeleted: {
   const { message: msg } = logOpts.data as MessageLogData;

   const container = createMessageContainer(
    t.logs.authorMessageDeletedForwarded({
     user: lF.getUser(logOpts.data.user),
     url: constants.formatters.msgURL(msg?.guild_id || '@me', msg?.channel_id || '', msg?.id || ''),
    }),
   );

   cloneMessageIntoContainer.call(container, msg);
   container.setAccentColor(Colors.Danger);
   payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);

   break;
  }

  case LogType.MessageEdited: {
   const { message: msg } = logOpts.data as MessageLogData;

   const container = createMessageContainer(
    t.logs.authorMessageEditedForwarded({
     user: lF.getUser(logOpts.data.user),
     url: constants.formatters.msgURL(msg?.guild_id || '@me', msg?.channel_id || '', msg?.id || ''),
    }),
   );

   cloneMessageIntoContainer.call(container, msg);
   container.setAccentColor(Colors.Loading);
   payload.setFlags(MessageFlags.IsComponentsV2).setComponents([container.toJSON()]);

   break;
  }

  default:
   this.client.logger.warn(`[Plugin:${this.name}] Unknown log type:`, logOpts.type);
   return { debug: 2 };
 }

 payload
  .setSendTo(
   [...new Set(logChannels.map((c) => c.id))].map((c) => ({
    channel: logChannels.find((lc) => lc.id === c)!.id,
    guildId: ticket.settings.guild,
   })),
  )
  .send();
 return { debug: 3 };
};

const createLogThread = async function (
 this: TicketPlugin,
 guildId: string,
 channelId: string,
 ticketId: string,
) {
 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket) return null;

 const t = await this.t(guildId);

 // TODO: replace with actual payload
 const payload = new MessagePayload(this.client, {
  origin: this.name,
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
    reason: 'Creating log thread message 2',
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

const getTranscript = async function (this: TicketPlugin, channel: RChannel | RThread) {
 const messages = await fetchMessages.call(
  this.client,
  channel.id,
  channel.guild_id,
  { amount: 1000 },
  { origin: this.name, reason: 'Fetching messages for transcript' },
 );

 const t = await this.t(channel.guild_id);

 return messages
  .map((m, i) => {
   if (m.embeds[0]?.author?.name && m.embeds[0]?.description) {
    return `${m.embeds[0]?.author?.name}: ${m.embeds[0]?.description}${i === 0 ? '\n' : ''}`;
   }
   return `${'user' in m ? m.user?.username : t.base.t.Unknown()}: ${m.content}`;
  })
  .reverse()
  .join('\n');
};

type ContextButton =
 | { authorName: string; button: ButtonBuilder; context?: never }
 | { authorName: string; button?: never; context: string }
 | { authorName: string; button?: never; context?: never };

export const cloneMessageIntoContainer = function (
 this: ContainerBuilder,
 msg: RMessage | GatewayMessageDeleteDispatchData | null,
 contextButton?: ContextButton,
) {
 switch (true) {
  case !!(contextButton?.authorName && contextButton?.button): {
   this.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(getAuthorNameComponent(contextButton.authorName))
     .setButtonAccessory(contextButton.button),
   );

   addSeparator.call(this);
   break;
  }

  case !!(contextButton?.authorName && contextButton?.context): {
   this.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(getAuthorNameComponent(contextButton.authorName))
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Secondary)
       .setDisabled(true)
       .setCustomId(contextButton.context)
       .setLabel('‎'),
     ),
   );

   addSeparator.call(this);
   break;
  }

  case !!contextButton?.authorName: {
   this.addTextDisplayComponents(getAuthorNameComponent(contextButton.authorName));

   addSeparator.call(this);
   break;
  }

  default:
   break;
 }

 if (!msg || !('content' in msg)) return;

 if (msg.content) {
  this.addTextDisplayComponents(new TextDisplayBuilder().setContent(msg.content));
 }

 const mediaAttachments = msg.attachments.filter((a) => a.width && a.height);
 if (mediaAttachments.length) {
  this.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    mediaAttachments.map((a) => {
     const item = new MediaGalleryItemBuilder().setURL(a.url);
     if (a.description) item.setDescription(a.description);
     return item;
    }),
   ),
  );
 }

 const nonMediaAttachments = msg.attachments.filter((a) => !a.width || !a.height);
 if (nonMediaAttachments.length) {
  nonMediaAttachments.forEach((a) => this.addFileComponents(new FileBuilder().setURL(a.url)));
 }

 if (msg.sticker_items?.length) {
  this.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    msg.sticker_items.map((i) =>
     new MediaGalleryItemBuilder().setURL(
      `https://media.discordapp.net/stickers/${i.id}.${StickerFormatType[i.format_type].replace('A', '')}`,
     ),
    ),
   ),
  );
 }

 addSeparator.call(this);
 this.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `-# ${constants.formatters.getTime(new Date(msg.timestamp).getTime())}`,
  ),
 );
};

const addSeparator = function (this: ContainerBuilder) {
 this.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
};

const getAuthorNameComponent = function (authorName: string) {
 return new TextDisplayBuilder().setContent(`-# ${authorName}`);
};

const createMessageContainer = function (authorName: string) {
 return new ContainerBuilder()
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${authorName}`))
  .addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
};
