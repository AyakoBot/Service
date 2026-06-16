import type { API } from '@ayako/api';
import { RequestHandlerError } from '@ayako/api';
import { TicketPlacementMode, TicketType } from '@ayako/database';
import type { TicketTier } from '@ayako/database';
import { LogLevel, txtFileWriter, type RChannel, type RThread } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 MessageFlags,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { Colors } from '../../../Types/index.js';
import getUser from '../../../Util/getUser.js';
import TicketPlugin from '../Plugin.js';
import { threadArchiveMinutes } from '../Util/threadArchiveDuration.js';

import BaseTicket, { SurfaceState } from './BaseTicket.js';
import ChannelTicket from './ChannelTicket.js';
import { ThreadTicketErrors } from './Enums.js';
import { TicketRoute } from './Routes.js';

export default class ThreadTicket extends ChannelTicket {
 channelTicket: ChannelTicket;

 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
  this.channelTicket = new ChannelTicket(client, ticketId, plugin);
 }

 static async findTicketByThreadChannelId(client: Client, channelId: string) {
  const entry = await client.db.client.ticket.findFirst({
   where: { dm: channelId },
   include: { settings: true },
  });
  if (!entry) return null;

  const ticketPlugin = client.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;
  if (!ticketPlugin) throw new Error('TicketPlugin not found');

  if (entry.settings.type !== TicketType.Thread) {
   throw new Error('Ticket found, but it is not a ThreadTicket');
  }

  return new ThreadTicket(client, String(entry.id), ticketPlugin);
 }

 async deleteChannel() {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  let user = await getUser.call(this.client, ticket.user);
  if (!user || user instanceof RequestHandlerError) {
   this.plugin.nonFatalError(user || new Error(), this.deleteChannel.name);
   user = null;
  }

  const t = await this.plugin.t(ticket.settings.guild);
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  const res = await api.channels.edit(
   ticket.channel,
   {
    archived: true,
    locked: true,
    name: `${t.archived()}-${user?.username || t.base.t.unknownUser()}`,
   },
   { origin: ThreadTicket.name, reason: 'Archiving ticket thread channel' },
  );

  if (!res || res instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.threadNotFound, { cause: res });
  }

  return res;
 }

 async revokeChannelAccess(api: API) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const remove = await api.threads.removeMember(ticket.channel, ticket.user, {
   origin: ThreadTicket.name,
   reason: 'Ticket closed',
  });

  if (remove instanceof RequestHandlerError) {
   this.plugin.nonFatalError(remove, this.revokeChannelAccess.name);
  }

  return remove ? [remove] : [];
 }

 async closeChannel(api: API, channel: RChannel | RThread) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  let user = await getUser.call(this.client, ticket.user);

  if (!user || user instanceof RequestHandlerError) {
   this.plugin.nonFatalError(user || new Error(), this.closeChannel.name);
   user = null;
  }

  this.revokeChannelAccess(api);

  const modify = await api.channels.edit(
   ticket.channel,
   {
    name: `${t.closed()}-${user?.username || channel.name.replace(`${t.archived()}-`, '')}`.slice(
     0,
     30,
    ),
    locked: true,
   },
   { origin: ThreadTicket.name, reason: 'Closing ticket thread channel' },
  );

  return modify;
 }

 async getChannel(id: string) {
  const channel = await this.client.cache.threads.get(id);
  if (!channel) throw new Error(ThreadTicketErrors.threadNotFound);

  return channel;
 }

 async createChannel(api: API, username: string) {
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  if (!ticket.settings.channel) {
   throw new Error(ThreadTicketErrors.threadChannelNotSet);
  }

  const host = await this.client.cache.channels.get(ticket.settings.channel);
  const thread = this.isForumChannel(host)
   ? await this.createForumPost(api, host, username)
   : await this.createPrivateThread(api, ticket.settings.channel, username);

  if (!thread || thread instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.create_CantCreateChannel, { cause: thread });
  }

  return thread;
 }

 async createPrivateThread(api: API, channelId: string, name: string) {
  const ticket = await this.getTicket();

  return api.channels.createThread(
   channelId,
   {
    name,
    type: ChannelType.PrivateThread,
    auto_archive_duration: threadArchiveMinutes[ticket.settings.archiveDuration],
   },
   undefined,
   { origin: ThreadTicket.name, reason: 'Creating thread for ticket' },
  );
 }

 async createForumPost(api: API, forum: RChannel, name: string) {
  const ticket = await this.getTicket();
  const idByName = await this.ensureForumTags(forum, ticket.settings.createTags);
  const appliedTags = ticket.settings.createTags
   .map((tagName) => idByName.get(tagName.slice(0, 20)))
   .filter((id): id is string => !!id)
   .slice(0, 5);

  const payload = await this.getInitPayload(true, null, SurfaceState.Opened);

  return api.channels.createForumThread(
   forum.id,
   { name, message: payload.getAPIPayload(), applied_tags: appliedTags },
   { origin: ThreadTicket.name, reason: 'Creating forum post for ticket' },
  );
 }

 async postInitialSurface(api: API, channel: RChannel | RThread): Promise<string> {
  const parent = channel.parent_id
   ? await this.client.cache.channels.get(channel.parent_id)
   : null;
  if (this.isForumChannel(parent)) return channel.id;

  return super.postInitialSurface(api, channel);
 }

 async grantChannelAccess(api: API, channelId: string, userId: string): Promise<void> {
  this.plugin.logger.logLocation(LogLevel.debug);

  const modify = await api.threads.addMember(channelId, userId, {
   origin: ThreadTicket.name,
   reason: 'Granting access to ticket thread channel',
  });

  if (modify instanceof RequestHandlerError) {
   throw new Error(ThreadTicketErrors.create_CantUpdatePermissions, { cause: modify });
  }

  return modify;
 }

 async staffThreadParentId(): Promise<string | null> {
  const ticket = await this.getTicket();
  if (!ticket.settings.staffThreads || !ticket.settings.staffThreadsChannel) return null;
  return ticket.settings.staffThreadsChannel;
 }

 staffThreadType(): ChannelType.PublicThread | ChannelType.PrivateThread {
  return ChannelType.PublicThread;
 }

 async *escalate(data: {
  userId: string;
  cmd: APIMessageComponentInteraction;
  targetTierId: string;
 }) {
  this.plugin.logger.logLocation(LogLevel.silly);

  const preTicket = await this.getTicket();
  if (preTicket.settings.placementMode === TicketPlacementMode.UnifiedForum) {
   return yield* super.escalate(data);
  }

  const superEscalate = BaseTicket.prototype.escalate.call(this, {
   userId: data.userId,
   targetTierId: data.targetTierId,
  });
  await superEscalate.next();

  const target = await this.getTier(data.targetTierId);
  const forkChannelId = await this.forkThread(target);

  await superEscalate.next({ channelId: forkChannelId ?? preTicket.channel });

  if (forkChannelId) await this.repostSurface();
  else await this.refreshSurface();
  await this.ackEphemeral(data.cmd, (t) => t.escalatedTo({ tier: target?.name || '' }));

  return this;
 }

 async forkThread(target: TicketTier | null): Promise<string | null> {
  if (!target?.channel) return null;
  this.plugin.logger.logLocation(LogLevel.debug);

  const ticket = await this.getTicket();
  const t = await this.plugin.t(ticket.settings.guild);
  const api = await this.plugin.getAPI(ticket.settings.guild, ticket.settings.botToken);

  let user = await getUser.call(this.client, ticket.user);
  if (!user || user instanceof RequestHandlerError) user = null;

  const fork = await api.channels.createThread(
   target.channel,
   {
    name: `${user?.username || t.base.t.unknownUser()}`.slice(0, 100),
    type: ChannelType.PrivateThread,
    auto_archive_duration: threadArchiveMinutes[ticket.settings.archiveDuration],
   },
   undefined,
   { origin: ThreadTicket.name, reason: 'Forking ticket thread for escalation' },
  );

  if (!fork || fork instanceof RequestHandlerError) {
   this.plugin.nonFatalError(fork || new Error(), this.forkThread.name);
   return null;
  }

  await this.addForkMember(api, fork.id, ticket.user);
  await this.sealOldThread(api, ticket.channel, ticket.settings.guild);

  return fork.id;
 }

 async addForkMember(api: API, channelId: string, userId: string) {
  const res = await api.threads.addMember(channelId, userId, {
   origin: ThreadTicket.name,
   reason: 'Re-adding requester to forked escalation thread',
  });
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, this.addForkMember.name);
 }

 async sealOldThread(api: API, channelId: string, guildId: string) {
  const t = await this.plugin.t(guildId);
  const transcript = await this.getTranscript(channelId, guildId);

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Warning)
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(t.escalatedAway()))
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId(this.plugin.getRoute(TicketRoute.Delete, this.id))
      .setLabel(t.base.t.Delete()),
    ),
   );

  const payload = new MessagePayload(this.client, {
   origin: ThreadTicket.name,
   reason: 'Posting escalation transcript segment',
  })
   .setComponents([container.toJSON()])
   .setFlags(MessageFlags.IsComponentsV2);

  if (transcript) payload.setFiles([txtFileWriter(transcript, t.base.t.Transcript())]);

  const sent = await api.channels.createMessage(channelId, payload.getAPIPayload(), {
   origin: ThreadTicket.name,
   reason: 'Dropping escalation transcript segment into old thread',
  });
  if (sent instanceof RequestHandlerError) this.plugin.nonFatalError(sent, this.sealOldThread.name);

  const lock = await api.channels.edit(
   channelId,
   { locked: true, archived: true },
   { origin: ThreadTicket.name, reason: 'Locking forked thread after escalation' },
  );
  if (lock instanceof RequestHandlerError) this.plugin.nonFatalError(lock, this.sealOldThread.name);
 }
}
