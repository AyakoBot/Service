import { RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import {
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';
import { MessageFlags } from 'discord-api-types/v10';
import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import type Client from '../../../Classes/Client.js';
import { serverVars } from '../../../Util/placeholderVars.js';
import { resolveSavedContent } from '../../../Util/savedRef.js';
import type ConfessionsPlugin from '../Plugin.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import {
 buildPost,
 buildReply,
 confessionTitle,
 menuButton,
 replyButton,
 submitButton,
 type ConfessionView,
 type ConfessionsTranslator,
} from '../Util/container.js';
import { ConfessionLogKind } from '../Util/logContainer.js';
import { PostMode, postModeFor, replyTarget } from '../Util/threads.js';

type PluginAPI = Awaited<ReturnType<ConfessionsPlugin['getAPI']>>;

type PostError = RequestHandlerError<RequestHandlerErrorType>;

interface Placement {
 channel: string;
 message: string;
 thread: string | null;
}

interface PostRequest {
 api: PluginAPI;
 channelId: string;
 title: string;
 payload: MessagePayload;
}

type Poster = (req: PostRequest) => Promise<Placement | PostError>;

const origin = 'Confessions';

export default class ConfessionPublisher {
 plugin: ConfessionsPlugin;
 client: Client;

 constructor(plugin: ConfessionsPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 private postForum = async (req: PostRequest): Promise<Placement | PostError> => {
  const thread = await req.api.channels.createForumThread(
   req.channelId,
   { name: req.title, message: req.payload.getAPIPayload() },
   { origin, reason: 'Posting confession' },
  );

  if (thread instanceof RequestHandlerError) {
   this.plugin.nonFatalError(thread, 'publish forum post');
   return thread;
  }

  return { channel: thread.id, message: thread.id, thread: thread.id };
 };

 private postMessage = async (req: PostRequest): Promise<Placement | PostError> => {
  const message = await req.api.channels.createMessage(req.channelId, req.payload.getAPIPayload(), {
   origin,
   reason: 'Posting confession',
  });

  if (message instanceof RequestHandlerError) {
   this.plugin.nonFatalError(message, 'publish message');
   return message;
  }

  return { channel: req.channelId, message: message.id, thread: null };
 };

 private threadUnder = async (
  req: PostRequest,
  placement: Placement | PostError,
 ): Promise<Placement | PostError> => {
  if (placement instanceof RequestHandlerError) return placement;

  const thread = await req.api.channels.createThread(
   req.channelId,
   { name: req.title },
   placement.message,
   { origin, reason: 'Opening confession thread' },
  );

  if (thread instanceof RequestHandlerError) {
   this.plugin.nonFatalError(thread, 'publish thread');
   return placement;
  }

  return { ...placement, thread: thread.id };
 };

 private placements: Record<PostMode, Poster> = {
  [PostMode.ForumPost]: (req) => this.postForum(req),
  [PostMode.Message]: (req) => this.postMessage(req),
  [PostMode.ThreadedMessage]: async (req) => this.threadUnder(req, await this.postMessage(req)),
 };

 private payloadFor = async (
  settings: ConfessionSetting,
  confessionId: string,
  t: ConfessionsTranslator,
  view: ConfessionView,
  api: PluginAPI,
 ): Promise<MessagePayload> => {
  const saved = await resolveSavedContent(this.client, settings.guild, {
   embed: settings.embed,
   components: settings.components,
  });
  const vars = {
   ...(await serverVars.call(this, settings.guild)),
   confession: view.content,
   number: view.number === null ? '' : String(view.number),
  };
  const route = (name: string, ...args: string[]) => this.plugin.getRoute(name, ...args);
  const menu = menuButton(
   route,
   confessionId,
   buttonEmoji(this.client.emojis.for(api).get(EmoteName.Menu)),
  );
  const post = buildPost(t, view, saved, vars, {
   menu,
   buttons: [
    ...(settings.submitButton ? [submitButton(t, route)] : []),
    replyButton(t, route, confessionId),
   ],
  });
  const payload = new MessagePayload(this.client, { origin, reason: 'Confession' })
   .setFlags(post.flags)
   .setComponents(post.components);

  return post.embeds.length ? payload.setEmbeds(post.embeds) : payload;
 };

 private numberFor = async (
  settings: ConfessionSetting,
  confession: ConfessionRow,
 ): Promise<number> => {
  if (confession.number !== null) return confession.number;

  const number = await this.plugin.confessions.allocateNumber(settings);
  await this.client.db.client.confession.update({ where: { id: confession.id }, data: { number } });

  return number;
 };

 private record = async (id: string, placement: Placement): Promise<void> => {
  await this.client.db.client.confession.update({
   where: { id },
   data: { ...placement, state: ConfessionState.Posted },
  });
 };

 private publishConfession = async (
  settings: ConfessionSetting,
  confession: ConfessionRow,
  approvedBy: string | null,
 ): Promise<string | null> => {
  const t = await this.plugin.t(settings.guild);
  if (!settings.channel) return t.errors.notEnabled();

  const view: ConfessionView = {
   number: await this.numberFor(settings, confession),
   numbered: settings.numbered,
   content: confession.content ?? '',
   media: confession.media,
   anonymity: settings.anonymity,
  };
  const target = await this.client.cache.channels.get(settings.channel);
  const api = await this.plugin.getAPI(settings.guild);

  const placement = await this.placements[postModeFor(target?.type, settings.autoThread)]({
   api,
   channelId: settings.channel,
   title: confessionTitle(t, view),
   payload: await this.payloadFor(settings, confession.id, t, view, api),
  });

  if (placement instanceof RequestHandlerError) {
   return t.errors.publishFailed({
    channel: `<#${settings.channel}>`,
    error: placement.errorMessage ?? t.base.errors.unknownError(),
   });
  }

  await this.record(confession.id, placement);
  await this.plugin.schedule.armDelete(settings, placement.channel, placement.message);
  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Posted,
   number: view.number,
   author: confession.author,
   actor: approvedBy,
   content: confession.content,
   media: confession.media,
   link: `https://discord.com/channels/${settings.guild}/${placement.channel}/${placement.message}`,
  });

  return null;
 };

 private publishReply = async (
  settings: ConfessionSetting,
  reply: ConfessionRow,
  approvedBy: string | null,
 ): Promise<string | null> => {
  const t = await this.plugin.t(settings.guild);
  const parent = reply.parent ? await this.plugin.confessions.byId(reply.parent) : null;
  if (!parent || parent.state !== ConfessionState.Posted || !parent.channel || !parent.message) {
   return t.errors.gone();
  }

  const api = await this.plugin.getAPI(settings.guild);
  const target = replyTarget({ channel: parent.channel, message: parent.message, thread: parent.thread });
  const channelId = target.channel;
  const view: ConfessionView = {
   number: null,
   numbered: false,
   content: reply.content ?? '',
   media: reply.media,
   anonymity: settings.anonymity,
  };
  const menu = menuButton(
   (name: string, ...args: string[]) => this.plugin.getRoute(name, ...args),
   reply.id,
   buttonEmoji(this.client.emojis.for(api).get(EmoteName.Menu)),
  );
  const payload = new MessagePayload(this.client, { origin, reason: 'Confession reply' })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(buildReply(t, view, menu));
  if (target.replyTo) payload.setReply(target.replyTo);

  const message = await api.channels.createMessage(channelId, payload.getAPIPayload(), {
   origin,
   reason: 'Posting confession reply',
  });

  if (message instanceof RequestHandlerError) {
   this.plugin.nonFatalError(message, 'publish reply');
   return t.errors.publishFailed({
    channel: `<#${channelId}>`,
    error: message.errorMessage ?? t.base.errors.unknownError(),
   });
  }

  await this.record(reply.id, { channel: channelId, message: message.id, thread: null });
  await this.plugin.schedule.armDelete(settings, channelId, message.id);
  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Posted,
   number: null,
   parentNumber: parent.number,
   author: reply.author,
   actor: approvedBy,
   content: reply.content,
   media: reply.media,
   link: `https://discord.com/channels/${settings.guild}/${channelId}/${message.id}`,
  });

  return null;
 };

 publish = (
  settings: ConfessionSetting,
  confession: ConfessionRow,
  approvedBy: string | null = null,
 ): Promise<string | null> =>
  confession.parent
   ? this.publishReply(settings, confession, approvedBy)
   : this.publishConfession(settings, confession, approvedBy);
}
