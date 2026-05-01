import { RequestHandlerError, type API, type EmojiResolvable } from '@ayako/api';
import type { Ticket, TicketSetting } from '@ayako/database';
import { sleep, type RMessage } from '@ayako/utility';
import {
 ComponentType,
 GatewayDispatchEvents,
 type APIButtonComponentWithCustomId,
 type APIMessage,
} from 'discord-api-types/v10';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import fetchMessages from '../../../../Util/fetchMessages.js';
import type TicketPlugin from '../../Plugin.js';
import { handleLog, type LogType } from '../InteractionCreate/util.js';

export const getTicketDirectMessageFromId = async function (
 this: TicketPlugin,
 ticket: Ticket & { settings: TicketSetting },
 msgId: string,
) {
 const messages = await fetchMessages
  .call(
   this.client,
   ticket.dm!,
   ticket.settings.guild,
   {
    amount: 500,
    after: ticket.starterDm || undefined,
    isDm: true,
   },
   {
    origin: this.name,
    reason: 'Fetching messages before the starter message to find the message to update',
   },
  )
  .then((r) => r.map((m) => ({ msg: m, buttons: getButtons(m) })));

 return messages.find((m) => m.buttons.map((b) => b.custom_id).includes(msgId))?.msg;
};

const getButtons = (message: RMessage | APIMessage): APIButtonComponentWithCustomId[] => {
 return (
  (
   message.components
    ?.map((c) => (c.type === ComponentType.Container ? c.components : []))
    .flat() || []
  )
   .filter((s) => s.type === ComponentType.Section)
   .flat() || []
 )
  .map((s) => s.accessory)
  .filter(
   (a): a is APIButtonComponentWithCustomId => a?.type === ComponentType.Button && 'custom_id' in a,
  );
};

export const removeSendMessagePrefixes = function (content: string, prefixes: string[]) {
 return content.replace(new RegExp(`^(${prefixes.join('|')})`), '').trim();
};

export const prepareLog = async function (
 this: TicketPlugin,
 msg: ExtractPayload<
  | GatewayDispatchEvents.MessageUpdate
  | GatewayDispatchEvents.MessageDelete
  | GatewayDispatchEvents.MessageCreate
 >,
 ticket: Ticket & { settings: TicketSetting },
 logType: LogType.MessageDeleted | LogType.MessageEdited | LogType.MessageSent,
) {
 let converted = await convertMsg.call(this, msg, ticket);

 handleLog.call(this, String(ticket.id), {
  type: logType,
  data: {
   user: converted.author,
   message: converted.msg || msg,
  },
 });
};

const convertMsg = async function (
 this: TicketPlugin,
 msg: ExtractPayload<
  | GatewayDispatchEvents.MessageUpdate
  | GatewayDispatchEvents.MessageDelete
  | GatewayDispatchEvents.MessageCreate
 >,
 ticket: Ticket & { settings: TicketSetting },
) {
 if ('author' in msg && msg.author) {
  return {
   msg: this.client.cache.messages.apiToR(
    msg as ExtractPayload<
     GatewayDispatchEvents.MessageUpdate | GatewayDispatchEvents.MessageCreate
    >,
    ticket.settings.guild,
   ),
   author: (
    msg as ExtractPayload<GatewayDispatchEvents.MessageUpdate | GatewayDispatchEvents.MessageCreate>
   ).author,
  };
 }

 const times = await this.client.cache.messages.getTimes(msg.id);
 const newestTime = Math.max(...times);
 const newestMsg = await this.client.cache.messages.getAt(newestTime, msg.id);
 return { msg: newestMsg, author: await this.client.cache.users.get(newestMsg?.author_id || '') };
};

export const doReaction = async function (
 this: API,
 ticket: Ticket & { settings: TicketSetting },
 channel: { dm: boolean; id: string },
 messageId: string,
 emoji: { main: EmojiResolvable; alt: EmojiResolvable },
 debugInfo: { origin: string; reason: string },
) {
 if (channel.dm) return doDMReaction.call(this, channel.id, messageId, emoji.main, debugInfo);
 return doGuildReaction.call(this, ticket, channel.id, messageId, emoji, debugInfo);
};

const doGuildReaction = async function (
 this: API,
 ticket: Ticket & { settings: TicketSetting },
 channelId: string,
 messageId: string,
 emoji: { main: EmojiResolvable; alt: EmojiResolvable },
 debugInfo: { origin: string; reason: string },
) {
 const react = await this.channels.addMessageReaction(
  ticket.settings.guild,
  channelId,
  messageId,
  emoji,
  debugInfo,
 );
 if (react instanceof RequestHandlerError) return;

 await sleep(1000);

 await this.channels.deleteMessageReaction(
  ticket.settings.guild,
  channelId,
  messageId,
  react,
  debugInfo,
 );
};

const doDMReaction = async function (
 this: API,
 channelId: string,
 messageId: string,
 emoji: string,
 debugInfo: { origin: string; reason: string },
) {
 const react = await this.channels.addDirectMessageReaction(channelId, messageId, emoji, debugInfo);
 if (react instanceof RequestHandlerError) return;

 await sleep(1000);

 await this.channels.deleteDirectMessageReaction(channelId, messageId, emoji, debugInfo);
};
