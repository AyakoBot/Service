// Main types entry point
/// <reference path="./gateway.d.ts" />

import type { RAutomod as _RAutomod } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/automod.js';
import type { RBan as _RBan } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/ban.js';
import type { RChannel as _RChannel } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';
import type { RCommand as _RCommand } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/command.js';
import type { RCommandPermission as _RCommandPermission } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/commandPermission.js';
import type { REmoji as _REmoji } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/emoji.js';
import type { REvent as _REvent } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/event.js';
import type { RGuild as _RGuild } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/guild.js';
import type { RGuildCommand as _RGuildCommand } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/guildCommand.js';
import type { RIntegration as _RIntegration } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/integration.js';
import type { RInvite as _RInvite } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/invite.js';
import type { RMember as _RMember } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/member.js';
import type { RMessage as _RMessage } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/message.js';
import type { RReaction as _RReaction } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/reaction.js';
import type { RRole as _RRole } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/role.js';
import type { RSoundboard as _RSoundboard } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/soundboard.js';
import type { RStage as _RStage } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/stage.js';
import type { RSticker as _RSticker } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/sticker.js';
import type { RThread as _RThread } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/thread.js';
import type { RThreadMember as _RThreadMember } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/threadMember.js';
import type { RUser as _RUser } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/user.js';
import type { RVoice as _RVoice } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/voice.js';
import type { RWebhook as _RWebhook } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/webhook.js';

declare global {
 type RAutomod = _RAutomod;
 type RBan = _RBan;
 type RChannel = _RChannel;
 type RCommand = _RCommand;
 type RCommandPermission = _RCommandPermission;
 type REmoji = _REmoji;
 type REvent = _REvent;
 type RGuild = _RGuild;
 type RGuildCommand = _RGuildCommand;
 type RIntegration = _RIntegration;
 type RInvite = _RInvite;
 type RMember = _RMember;
 type RMessage = _RMessage;
 type RReaction = _RReaction;
 type RRole = _RRole;
 type RSoundboard = _RSoundboard;
 type RStage = _RStage;
 type RSticker = _RSticker;
 type RThread = _RThread;
 type RThreadMember = _RThreadMember;
 type RUser = _RUser;
 type RVoice = _RVoice;
 type RWebhook = _RWebhook;
}
