import * as Discord from 'discord.js';
import Jobs from 'node-schedule';
import * as CT from '../../Typings/Typings.js';
import * as Classes from '../Other/classes.js';
import { request } from './requestHandler.js';
import { getEmbedCharLens, isValidPayload } from './requestHandler/channels/sendMessage.js';

export interface MessageCreateOptions extends Omit<RMessageCreateOptions, 'embeds'> {
 embeds?: Discord.APIEmbed[];
}

async function send<T extends number | undefined>(
 channels: RUser,
 payload: CT.UsualMessagePayload,
 timeout?: T,
): Promise<T extends number ? RMessage : null | void>;
async function send<T extends number | undefined>(
 channels: Discord.TextBasedChannel[],
 payload: CT.UsualMessagePayload,
 timeout?: T,
): Promise<(T extends number ? RMessage : null | void)[] | null | void>;
async function send<T extends number | undefined>(
 channels: { id: string; guildId: string },
 payload: CT.UsualMessagePayload,
 timeout?: T,
): Promise<RMessage | null | void>;
async function send<T extends number | undefined>(
 channels: { id: string[]; guildId: string },
 payload: CT.UsualMessagePayload,
 timeout?: T,
): Promise<(T extends number ? RMessage : null | void)[] | null | void>;
async function send<T extends number | undefined>(
 channels: Discord.TextBasedChannel | RThread,
 payload: CT.UsualMessagePayload,
 timeout?: T,
): Promise<T extends number ? RMessage : null | void>;
/**
 * Sends a message to a Discord channel or user.
 * @param channels - The channel or user to send the message to.
 * @param payload - The message payload to send.
 * @param timeout - The timeout for the message, if any.
 * @returns A Promise that resolves to the sent message, an array of sent messages, or null/void.
 */
async function send(
 channels:
  | Discord.TextBasedChannel
  | Discord.TextBasedChannel[]
  | { id: string[]; guildId: string }
  | { id: string; guildId: string }
  | RUser,
 payload: CT.UsualMessagePayload,
 timeout?: number,
): Promise<RMessage | (RMessage | null | void)[] | null | void> {
 if (!isValidPayload(payload)) return null;
 if (!channels) return null;

 if (Array.isArray(channels)) {
  const sentMessages = await Promise.all(channels.map((ch) => send(ch, payload, timeout)));
  return sentMessages;
 }

 if (Array.isArray(channels.id)) {
  const sentMessages = await Promise.all(
   channels.id.map((id) =>
    send({ id, guildId: (channels as RChannel).guildId }, payload, timeout),
   ),
  );
  return sentMessages;
 }

 if (payload.files?.length) timeout = undefined;
 if (Number(payload.embeds?.length) > 1) timeout = undefined;
 if (payload.components?.length) timeout = undefined;
 if (payload.content?.length) timeout = undefined;

 const channel = await getChannel(channels as Parameters<typeof getChannel>[0]);
 if (!channel) return null;

 if (!('send' in channel)) return null;

 if (
  !payload.content?.length &&
  !payload.embeds?.length &&
  !payload.files?.length &&
  !payload.components?.length
 ) {
  return null;
 }

 payload.embeds?.forEach((e) => {
  if (e.author && !e.author.url) e.author.url = channel.client.util.constants.standard.invite;

  e.fields?.forEach((f) => {
   if (typeof f.inline !== 'boolean') f.inline = true;
  });
 });

 if (timeout && 'guild' in channel && payload.embeds?.length) {
  combineMessages(channel as RChannel, payload.embeds, timeout);
  return null;
 }

 const body = (await new RMessagePayload(channel as RMessageTarget, payload)
  .resolveBody()
  .resolveFiles()) as {
  body: Discord.RESTPostAPIChannelMessageJSONBody;
  files: Discord.RawFile[];
 };

 body.body.allowed_mentions = {
  parse: [Discord.AllowedMentionsTypes.User],
  roles: payload.allowed_mentions?.roles,
  replied_user: payload.allowed_mentions?.replied_user ?? false,
 };

 const sentMessage = await request.channels.sendMessage(
  'guild' in channel ? channel.guild : undefined,
  channel.id,
  { ...body.body, files: body.files },
  channel.client,
 );
 if ('message' in sentMessage) return null;

 return sentMessage;
}

export default send;

/**
 * Combines multiple embeds and sends them to a channel.
 * If the combined embeds exceed the character limit or the maximum number of embeds per message,
 * the function splits them into multiple messages.
 * @param channel The channel to send the embeds to.
 * @param embeds An array of embeds to send.
 * @param timeout The time in milliseconds before the message times out.
 */
const combineMessages = async (
 channel:
  | Discord.AnyThreadChannel
  | RChannel
  | RChannel
  | Discord.VoiceChannel,
 embeds: Discord.APIEmbed[],
 timeout: number,
) => {
 const channelQueue = channel.client.util.cache.channelQueue.get(channel.id);
 if (!channelQueue) {
  channel.client.util.cache.channelQueue.set(channel.id, {
   channel,
   job: Jobs.scheduleJob(
    channel.client.util.getPathFromError(new Error()),
    new Date(Date.now() + timeout),
    () => {
     const queue = channel.client.util.cache.channelQueue.get(channel.id);
     if (!queue) return;

     channel.client.util.cache.channelQueue.delete(channel.id);
     send(channel, { embeds: queue.embeds });
    },
   ),
   embeds,
  });
  return;
 }

 const { embeds: oldEmbeds } = channelQueue;
 if (getEmbedCharLens([...oldEmbeds, ...embeds]) > 6000 || embeds.length + oldEmbeds.length > 10) {
  send(channel, { embeds: oldEmbeds });
  channelQueue.embeds = embeds;
  return;
 }

 channelQueue.embeds = [...oldEmbeds, ...embeds];
};

/**
 * Returns a channel object based on the given input.
 * @param channels - A Discord user, text-based channel, or an object with an ID and guild ID.
 * @returns A channel object.
 */
const getChannel = async (
 channels:
  | RUser
  | Discord.TextBasedChannel
  | {
     id: string;
     guildId: string;
    },
) => {
 const { default: client, API } = await import('../Client.js');

 if ('username' in channels) {
  const dm = await API.users.createDM(channels.id).catch(() => undefined);
  if (!dm) return dm;

  return Classes.Channel<ChannelType.DM>(client, dm, undefined as never);
 }
 return 'name' in channels ? channels : client.channels.cache.get(channels.id);
};
