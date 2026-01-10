/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { EventEmitter } from 'node:events';

import type AuditLogCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/auditlog.js';
import type AutomodCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/automod.js';
import type BanCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/ban.js';
import type ChannelCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';
import type ChannelStatusCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channelStatus.js';
import type CommandCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/command.js';
import type CommandPermissionCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/commandPermission.js';
import type EmojiCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/emoji.js';
import type EventCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/event.js';
import type GuildCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/guild.js';
import type GuildCommandCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/guildCommand.js';
import type IntegrationCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/integration.js';
import type InviteCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/invite.js';
import type MemberCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/member.js';
import type MessageCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/message.js';
import type OnboardingCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/onboarding.js';
import type PinCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/pin.js';
import type ReactionCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/reaction.js';
import type RoleCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/role.js';
import type SoundboardCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/soundboard.js';
import type StageCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/stage.js';
import type StickerCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/sticker.js';
import type ThreadCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/thread.js';
import type ThreadMemberCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/threadMember.js';
import type UserCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/user.js';
import type VoiceCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/voice.js';
import type WebhookCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/webhook.js';
import type WelcomeScreenCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/welcomeScreen.js';
import { GatewayDispatchEvents } from '@discordjs/core';
import Redis from 'ioredis';

import { MessageType } from '../Types/redis.js';

import logger from './Logger.js';

const messageTypes = [MessageType.Interaction, MessageType.Vote, MessageType.Appeal];

const cacheImports: {
 AuditLogCache: new (...args: any[]) => AuditLogCache;
 BanCache: new (...args: any[]) => BanCache;
 AutomodCache: new (...args: any[]) => AutomodCache;
 ChannelCache: new (...args: any[]) => ChannelCache;
 ChannelStatusCache: new (...args: any[]) => ChannelStatusCache;
 CommandCache: new (...args: any[]) => CommandCache;
 CommandPermissionCache: new (...args: any[]) => CommandPermissionCache;
 EmojiCache: new (...args: any[]) => EmojiCache;
 EventCache: new (...args: any[]) => EventCache;
 GuildCache: new (...args: any[]) => GuildCache;
 GuildCommandCache: new (...args: any[]) => GuildCommandCache;
 IntegrationCache: new (...args: any[]) => IntegrationCache;
 InviteCache: new (...args: any[]) => InviteCache;
 MemberCache: new (...args: any[]) => MemberCache;
 MessageCache: new (...args: any[]) => MessageCache;
 ReactionCache: new (...args: any[]) => ReactionCache;
 RoleCache: new (...args: any[]) => RoleCache;
 SoundboardCache: new (...args: any[]) => SoundboardCache;
 StageCache: new (...args: any[]) => StageCache;
 StickerCache: new (...args: any[]) => StickerCache;
 ThreadCache: new (...args: any[]) => ThreadCache;
 ThreadMemberCache: new (...args: any[]) => ThreadMemberCache;
 UserCache: new (...args: any[]) => UserCache;
 VoiceCache: new (...args: any[]) => VoiceCache;
 WebhookCache: new (...args: any[]) => WebhookCache;
 PinCache: new (...args: any[]) => PinCache;
 WelcomeScreenCache: new (...args: any[]) => WelcomeScreenCache;
 OnboardingCache: new (...args: any[]) => OnboardingCache;
} = {
 AuditLogCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/auditlog.js'
 ).then((r) => r.default as any),
 BanCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/ban.js'
 ).then((r) => r.default as any),
 AutomodCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/automod.js'
 ).then((r) => r.default as any),
 ChannelCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/channel.js'
 ).then((r) => r.default as any),
 ChannelStatusCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/channelStatus.js'
 ).then((r) => r.default as any),
 CommandCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/command.js'
 ).then((r) => r.default as any),
 CommandPermissionCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/commandPermission.js'
 ).then((r) => r.default as any),
 EmojiCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/emoji.js'
 ).then((r) => r.default as any),
 EventCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/event.js'
 ).then((r) => r.default as any),
 GuildCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guild.js'
 ).then((r) => r.default as any),
 GuildCommandCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guildCommand.js'
 ).then((r) => r.default as any),
 IntegrationCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/integration.js'
 ).then((r) => r.default as any),
 InviteCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/invite.js'
 ).then((r) => r.default as any),
 MemberCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/member.js'
 ).then((r) => r.default as any),
 MessageCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/message.js'
 ).then((r) => r.default as any),
 ReactionCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/reaction.js'
 ).then((r) => r.default as any),
 RoleCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/role.js'
 ).then((r) => r.default as any),
 SoundboardCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/soundboard.js'
 ).then((r) => r.default as any),
 StageCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/stage.js'
 ).then((r) => r.default as any),
 StickerCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/sticker.js'
 ).then((r) => r.default as any),
 ThreadCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/thread.js'
 ).then((r) => r.default as any),
 ThreadMemberCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/threadMember.js'
 ).then((r) => r.default as any),
 UserCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/user.js'
 ).then((r) => r.default as any),
 VoiceCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/voice.js'
 ).then((r) => r.default as any),
 WebhookCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/webhook.js'
 ).then((r) => r.default as any),
 PinCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/pin.js'
 ).then((r) => r.default as any),
 WelcomeScreenCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/welcomeScreen.js'
 ).then((r) => r.default as any),
 OnboardingCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/onboarding.js'
 ).then((r) => r.default as any),
};

class Cache extends EventEmitter {
 readonly prefix = 'cache';
 readonly cacheDbNum: number;
 readonly schedDbNum: number;

 readonly cacheDb: Redis;
 readonly cacheSub: Redis;
 readonly scheduleDb: Redis;
 readonly scheduleSub: Redis;

 constructor(cacheDbNum: number, schedDbNum: number) {
  super();

  logger.debug('[Cache] Initializing cache with cacheDb:', cacheDbNum, 'schedDb:', schedDbNum);

  this.cacheDbNum = cacheDbNum;
  this.schedDbNum = schedDbNum;

  logger.silly('[Cache] Creating Redis connections...');
  this.cacheDb = new Redis({ host: '127.0.0.1', db: cacheDbNum });
  this.cacheSub = new Redis({ host: '127.0.0.1', db: cacheDbNum });
  this.scheduleDb = new Redis({ host: '127.0.0.1', db: schedDbNum });
  this.scheduleSub = new Redis({ host: '127.0.0.1', db: schedDbNum });

  logger.silly('[Cache] Configuring Redis keyspace notifications');
  this.cacheDb.config('SET', 'notify-keyspace-events', 'Ex');
  this.scheduleDb.config('SET', 'notify-keyspace-events', 'Ex');

  logger.debug('[Cache] Subscribing to Redis channels');
  this.cacheSub.subscribe(
   `__keyevent@${schedDbNum}__:expired`,
   ...Object.values(GatewayDispatchEvents),
   ...messageTypes,
  );
  this.scheduleSub.subscribe(`__keyevent@${schedDbNum}__:expired`);

  logger.silly('[Cache] Initializing cache classes...');
  this.audits = new cacheImports.AuditLogCache(this.cacheDb);
  this.automods = new cacheImports.AutomodCache(this.cacheDb);
  this.bans = new cacheImports.BanCache(this.cacheDb);
  this.channels = new cacheImports.ChannelCache(this.cacheDb);
  this.channelStatus = new cacheImports.ChannelStatusCache(this.cacheDb);
  this.commands = new cacheImports.CommandCache(this.cacheDb);
  this.commandPermissions = new cacheImports.CommandPermissionCache(this.cacheDb);
  this.emojis = new cacheImports.EmojiCache(this.cacheDb);
  this.events = new cacheImports.EventCache(this.cacheDb);
  this.guilds = new cacheImports.GuildCache(this.cacheDb);
  this.guildCommands = new cacheImports.GuildCommandCache(this.cacheDb);
  this.integrations = new cacheImports.IntegrationCache(this.cacheDb);
  this.invites = new cacheImports.InviteCache(this.cacheDb);
  this.members = new cacheImports.MemberCache(this.cacheDb);
  this.messages = new cacheImports.MessageCache(this.cacheDb);
  this.reactions = new cacheImports.ReactionCache(this.cacheDb);
  this.roles = new cacheImports.RoleCache(this.cacheDb);
  this.soundboards = new cacheImports.SoundboardCache(this.cacheDb);
  this.stages = new cacheImports.StageCache(this.cacheDb);
  this.stickers = new cacheImports.StickerCache(this.cacheDb);
  this.threads = new cacheImports.ThreadCache(this.cacheDb);
  this.threadMembers = new cacheImports.ThreadMemberCache(this.cacheDb);
  this.users = new cacheImports.UserCache(this.cacheDb);
  this.voices = new cacheImports.VoiceCache(this.cacheDb);
  this.webhooks = new cacheImports.WebhookCache(this.cacheDb);
  this.pins = new cacheImports.PinCache(this.cacheDb);
  this.welcomeScreens = new cacheImports.WelcomeScreenCache(this.cacheDb);
  this.onboardings = new cacheImports.OnboardingCache(this.cacheDb);

  this.cacheSub.on('message', this.callback);
  this.scheduleSub.on('message', this.callback);

  logger.log('[Cache] Cache initialization complete');
 }

 readonly audits: AuditLogCache;
 readonly automods: AutomodCache;
 readonly bans: BanCache;
 readonly channels: ChannelCache;
 readonly channelStatus: ChannelStatusCache;
 readonly commands: CommandCache;
 readonly commandPermissions: CommandPermissionCache;
 readonly emojis: EmojiCache;
 readonly events: EventCache;
 readonly guilds: GuildCache;
 readonly guildCommands: GuildCommandCache;
 readonly integrations: IntegrationCache;
 readonly invites: InviteCache;
 readonly members: MemberCache;
 readonly messages: MessageCache;
 readonly reactions: ReactionCache;
 readonly roles: RoleCache;
 readonly soundboards: SoundboardCache;
 readonly stages: StageCache;
 readonly stickers: StickerCache;
 readonly threads: ThreadCache;
 readonly threadMembers: ThreadMemberCache;
 readonly users: UserCache;
 readonly voices: VoiceCache;
 readonly webhooks: WebhookCache;
 readonly pins: PinCache;
 readonly welcomeScreens: WelcomeScreenCache;
 readonly onboardings: OnboardingCache;

 private callback = async (channel: string, key: string) => {
  logger.silly('[Cache] Received message on channel:', channel);

  if (
   messageTypes.includes(channel as MessageType) ||
   Object.values(GatewayDispatchEvents).includes(channel as GatewayDispatchEvents)
  ) {
   const eventName = Object.entries(GatewayDispatchEvents).find(([, val]) => val === channel)?.[1];
   if (!eventName) {
    logger.debug('[Cache] No event name found for channel:', channel);
    return;
   }

   let data = key ? JSON.parse(key) : null;
   if (typeof data === 'string') data = JSON.parse(data);

   if (!key.includes('669893888856817665')) return; // TODO disable dev filter

   logger.silly('[Cache] Emitting event:', eventName);
   logger.silly('[Cache] Event data:', data);
   this.emit(eventName, data);
  }

  if (
   channel !== `__keyevent@${this.scheduleDb.options.db}__:expired` &&
   channel !== `__keyevent@${this.cacheDb.options.db}__:expired`
  ) {
   return;
  }

  if (key.includes('scheduled-data:')) return;

  const keyArgs = key.split(/:/g).splice(0, 3);
  const eventName = keyArgs.filter((k) => Number.isNaN(+k)).join('/');

  logger.debug('[Cache] Key expired:', key, '-> event:', eventName);

  const dataKey = key.replace('scheduled:', 'scheduled-data:');
  const [dbNum] = channel.split('@')[1].split(':');
  const db = dbNum === String(this.cacheDbNum) ? this.cacheDb : this.scheduleDb;

  const value = await db.get(dataKey);
  db.expire(dataKey, 10);

  logger.silly('[Cache] Emitting expire event for:', eventName);
  this.emit('expire', { eventName, value: value ? JSON.parse(value) : null });
 };
}

const cacheDbNum = process.argv.includes('--dev') ? 2 : 0;
const schedDbNum = process.argv.includes('--dev') ? 3 : 1;

const cache = new Cache(cacheDbNum, schedDbNum);
export default cache;
