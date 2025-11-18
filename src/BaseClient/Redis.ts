import { GatewayDispatchEvents } from '@discordjs/core';
import { glob } from 'glob';
import Redis from 'ioredis';
import baseEventHandler from '../Events/BotEvents/baseEventHandler.js';
import { MessageType } from '../Typings/Typings.js';

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
import type PinCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/pin.js';
import type WelcomeScreenCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/welcomeScreen.js';
import type OnboardingCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/onboarding.js';

const MessageTypes = [MessageType.Interaction, MessageType.Vote, MessageType.Appeal];

const cacheImports: {
 BanCache: new (...args: any[]) => BanCache;
 AutomodCache: new (...args: any[]) => AutomodCache;
 ChannelCache: new (...args: any[]) => ChannelCache;
 ChannelStatusCache: new (...args: any[]) => any;
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
 channelStatus: ChannelStatusCache;
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
 pins: PinCache;
 welcomeScreens: WelcomeScreenCache;
 onboardings: OnboardingCache;
} = {
 automods: new cacheImports.AutomodCache(cacheDB),
 bans: new cacheImports.BanCache(cacheDB),
 channels: new cacheImports.ChannelCache(cacheDB),
 channelStatus: new cacheImports.ChannelStatusCache(cacheDB),
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
 pins: new cacheImports.PinCache(cacheDB),
 welcomeScreens: new cacheImports.WelcomeScreenCache(cacheDB),
 onboardings: new cacheImports.OnboardingCache(cacheDB),
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
