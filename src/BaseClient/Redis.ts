import { GatewayDispatchEvents } from '@discordjs/core';
import { glob } from 'glob';
import Redis from 'ioredis';
import baseEventHandler from '../Events/BotEvents/baseEventHandler.js';
import { MessageType } from '../Typings/Typings.js';

import type AutomodCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/automod.js';
import type BanCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/ban.js';
import type ChannelCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';
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

const MessageTypes = [MessageType.Interaction, MessageType.Vote, MessageType.Appeal];

const cacheImports: {
 BanCache: new (...args: any[]) => BanCache;
 AutomodCache: new (...args: any[]) => AutomodCache;
 ChannelCache: new (...args: any[]) => ChannelCache;
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
} = {
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 BanCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/ban.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 AutomodCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/automod.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 ChannelCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/channel.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 CommandCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/command.js').then(
  (r) => r.default as any,
 ),
 CommandPermissionCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/commandPermission.js'
 ).then((r) => r.default as any),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 EmojiCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/emoji.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 EventCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/event.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 GuildCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guild.js').then(
  (r) => r.default as any,
 ),
 GuildCommandCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guildCommand.js'
 ).then((r) => r.default as any),
 IntegrationCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/integration.js'
 ).then((r) => r.default as any),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 InviteCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/invite.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 MemberCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/member.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 MessageCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/message.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 ReactionCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/reaction.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 RoleCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/role.js').then(
  (r) => r.default as any,
 ),
 SoundboardCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/soundboard.js'
 ).then((r) => r.default as any),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 StageCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/stage.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 StickerCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/sticker.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 ThreadCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/thread.js').then(
  (r) => r.default as any,
 ),
 ThreadMemberCache: await import(
  // @ts-ignore - Module resolution for dynamic imports from gateway dist
  '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/threadMember.js'
 ).then((r) => r.default as any),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 UserCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/user.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 VoiceCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/voice.js').then(
  (r) => r.default as any,
 ),
 // @ts-ignore - Module resolution for dynamic imports from gateway dist
 WebhookCache: await import('@ayako/gateway/dist/BaseClient/Bot/CacheClasses/webhook.js').then(
  (r) => r.default as any,
 ),
};

export const prefix = 'cache';
const cacheDBnum = process.argv.includes('--dev') ? 2 : 0;
const scheduleDBnum = process.argv.includes('--dev') ? 3 : 1;

export const cacheDB = new Redis({ host: '127.0.0.1', db: cacheDBnum });
export const cacheSub = new Redis({ host: '127.0.0.1', db: cacheDBnum });
export const scheduleDB = new Redis({ host: '127.0.0.1', db: scheduleDBnum });
export const scheduleSub = new Redis({ host: '127.0.0.1', db: scheduleDBnum });

export default cacheDB;

await cacheDB.config('SET', 'notify-keyspace-events', 'Ex');
await scheduleDB.config('SET', 'notify-keyspace-events', 'Ex');

await cacheSub.subscribe(
 `__keyevent@${cacheDBnum}__:expired`,
 ...Object.values(GatewayDispatchEvents),
 ...MessageTypes,
);
await scheduleSub.subscribe(`__keyevent@${scheduleDBnum}__:expired`);

export const cache: {
 automods: AutomodCache;
 bans: BanCache;
 channels: ChannelCache;
 commands: CommandCache;
 commandPermissions: CommandPermissionCache;
 emojis: EmojiCache;
 events: EventCache;
 guilds: GuildCache;
 guildCommands: GuildCommandCache;
 integrations: IntegrationCache;
 invites: InviteCache;
 members: MemberCache;
 messages: MessageCache;
 reactions: ReactionCache;
 roles: RoleCache;
 soundboards: SoundboardCache;
 stages: StageCache;
 stickers: StickerCache;
 threads: ThreadCache;
 threadMembers: ThreadMemberCache;
 users: UserCache;
 voices: VoiceCache;
 webhooks: WebhookCache;
} = {
 automods: new cacheImports.AutomodCache(cacheDB),
 bans: new cacheImports.BanCache(cacheDB),
 channels: new cacheImports.ChannelCache(cacheDB),
 commands: new cacheImports.CommandCache(cacheDB),
 commandPermissions: new cacheImports.CommandPermissionCache(cacheDB),
 emojis: new cacheImports.EmojiCache(cacheDB),
 events: new cacheImports.EventCache(cacheDB),
 guilds: new cacheImports.GuildCache(cacheDB),
 guildCommands: new cacheImports.GuildCommandCache(cacheDB),
 integrations: new cacheImports.IntegrationCache(cacheDB),
 invites: new cacheImports.InviteCache(cacheDB),
 members: new cacheImports.MemberCache(cacheDB),
 messages: new cacheImports.MessageCache(cacheDB),
 reactions: new cacheImports.ReactionCache(cacheDB),
 roles: new cacheImports.RoleCache(cacheDB),
 soundboards: new cacheImports.SoundboardCache(cacheDB),
 stages: new cacheImports.StageCache(cacheDB),
 stickers: new cacheImports.StickerCache(cacheDB),
 threads: new cacheImports.ThreadCache(cacheDB),
 threadMembers: new cacheImports.ThreadMemberCache(cacheDB),
 users: new cacheImports.UserCache(cacheDB),
 voices: new cacheImports.VoiceCache(cacheDB),
 webhooks: new cacheImports.WebhookCache(cacheDB),
};

const callback = async (channel: string, key: string) => {
 if (MessageTypes.includes(channel) || Object.values(GatewayDispatchEvents).includes(channel)) {
  const eventName = Object.entries(GatewayDispatchEvents).find(([, val]) => val === channel)?.[0];
  if (!eventName) return;

  let data = key ? JSON.parse(key) : undefined;
  if (typeof data === 'string') data = JSON.parse(data);

  baseEventHandler(eventName, Array.isArray(data) ? data : [data]);
 }

 if (
  channel !== `__keyevent@${cacheDBnum}__:expired` &&
  channel !== `__keyevent@${scheduleDBnum}__:expired`
 ) {
  return;
 }

 if (key.includes('scheduled-data:')) return;

 const keyArgs = key.split(/:/g).splice(0, 3);
 const path = keyArgs.filter((k) => Number.isNaN(+k)).join('/');

 const dataKey = key.replace('scheduled:', 'scheduled-data:');
 const dbNum = channel.split('@')[1].split(':')[0];
 const db = dbNum === String(cacheDBnum) ? cacheDB : scheduleDB;

 const value = await db.get(dataKey);
 db.expire(dataKey, 10);

 const files = await glob(
  `${process.cwd()}${process.cwd().includes('dist') ? '' : '/dist'}/Events/RedisEvents/scheduled}/**/*`,
 );

 const file = files.find((f) => f.endsWith(`${path}.js`));
 if (!file) return;

 (await import(file)).default(value ? JSON.parse(value) : undefined);
};

cacheSub.on('message', callback);
scheduleSub.on('message', callback);
