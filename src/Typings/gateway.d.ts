// Import the actual types from the source files
import type BanCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/ban.js';
import type AutomodCache from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/automod.js';
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

// Declare individual cache class modules for @ayako/gateway dist files
declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/ban.js' {
  const cache: new (...args: any[]) => BanCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/automod.js' {
  const cache: new (...args: any[]) => AutomodCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/channel.js' {
  const cache: new (...args: any[]) => ChannelCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/command.js' {
  const cache: new (...args: any[]) => CommandCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/commandPermission.js' {
  const cache: new (...args: any[]) => CommandPermissionCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/emoji.js' {
  const cache: new (...args: any[]) => EmojiCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/event.js' {
  const cache: new (...args: any[]) => EventCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guild.js' {
  const cache: new (...args: any[]) => GuildCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/guildCommand.js' {
  const cache: new (...args: any[]) => GuildCommandCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/integration.js' {
  const cache: new (...args: any[]) => IntegrationCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/invite.js' {
  const cache: new (...args: any[]) => InviteCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/member.js' {
  const cache: new (...args: any[]) => MemberCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/message.js' {
  const cache: new (...args: any[]) => MessageCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/reaction.js' {
  const cache: new (...args: any[]) => ReactionCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/role.js' {
  const cache: new (...args: any[]) => RoleCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/soundboard.js' {
  const cache: new (...args: any[]) => SoundboardCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/stage.js' {
  const cache: new (...args: any[]) => StageCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/sticker.js' {
  const cache: new (...args: any[]) => StickerCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/thread.js' {
  const cache: new (...args: any[]) => ThreadCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/threadMember.js' {
  const cache: new (...args: any[]) => ThreadMemberCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/user.js' {
  const cache: new (...args: any[]) => UserCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/voice.js' {
  const cache: new (...args: any[]) => VoiceCache;
  export default cache;
}

declare module '@ayako/gateway/dist/BaseClient/Bot/CacheClasses/webhook.js' {
  const cache: new (...args: any[]) => WebhookCache;
  export default cache;
}
