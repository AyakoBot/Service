import { getChannelPerms, getGuildPerms } from '@ayako/utility';
import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 ComponentType,
 OverwriteType,
 PermissionFlagsBits,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import {
 getChannelOption,
 getRoleOption,
 getUserOption,
} from '../../../../Util/interactionOptions.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { PermsTarget } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { nameOf } from '../../Util/fmt.js';
import { respond, respondError, type Translator } from '../../Util/respond.js';

export enum PermCategory {
 General = 'GENERAL',
 Member = 'MEMBER',
 Text = 'TEXT',
 Voice = 'VOICE',
 Stage = 'STAGE',
 Events = 'EVENTS',
 Advanced = 'ADVANCED',
}

const categoryPerms: Record<PermCategory, (keyof typeof PermissionFlagsBits)[]> = {
 [PermCategory.General]: [
  'ViewChannel',
  'ManageChannels',
  'ManageRoles',
  'CreateGuildExpressions',
  'ManageGuildExpressions',
  'ViewAuditLog',
  'ViewGuildInsights',
  'ManageWebhooks',
  'ManageGuild',
 ],
 [PermCategory.Member]: [
  'CreateInstantInvite',
  'ChangeNickname',
  'ManageNicknames',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
 ],
 [PermCategory.Text]: [
  'SendMessages',
  'SendMessagesInThreads',
  'CreatePublicThreads',
  'CreatePrivateThreads',
  'EmbedLinks',
  'AttachFiles',
  'AddReactions',
  'UseExternalEmojis',
  'UseExternalStickers',
  'MentionEveryone',
  'ManageMessages',
  'ManageThreads',
  'ReadMessageHistory',
  'SendTTSMessages',
  'UseApplicationCommands',
  'SendVoiceMessages',
  'SendPolls',
 ],
 [PermCategory.Voice]: [
  'Connect',
  'Speak',
  'Stream',
  'UseSoundboard',
  'UseExternalSounds',
  'UseVAD',
  'PrioritySpeaker',
  'MuteMembers',
  'DeafenMembers',
  'MoveMembers',
  'UseEmbeddedActivities',
 ],
 [PermCategory.Stage]: ['RequestToSpeak'],
 [PermCategory.Events]: ['CreateEvents', 'ManageEvents'],
 [PermCategory.Advanced]: ['Administrator'],
};

export const permsContainer = (
 emotes: EmoteSet,
 t: Translator,
 title: string,
 allow: bigint,
): ContainerBuilder => {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`## ${textEmote(emotes.permissions)} ${title}`),
 );

 Object.entries(categoryPerms).forEach(([category, keys]) => {
  const lines = keys.map((key) => {
   const has = (allow & PermissionFlagsBits[key]) === PermissionFlagsBits[key];
   return `${textEmote(has ? emotes.enabled : emotes.disabled)} ${nameOf(
    t.base.permissions.perms,
    key,
    key,
   )}`;
  });

  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `### ${nameOf(t.base.permissions.categories, category, category)}\n${lines.join('\n')}`,
   ),
  );
 });

 return container;
};

export const roleChannelPerms = async function (
 this: InfoPlugin,
 guildId: string,
 roleId: string,
 channelId: string,
): Promise<bigint> {
 const [role, everyone, channel] = await Promise.all([
  this.client.cache.roles.get(roleId),
  this.client.cache.roles.get(guildId),
  this.client.cache.channels.get(channelId),
 ]);
 if (!role) return 0n;

 let permissions = BigInt(everyone?.permissions ?? 0) | BigInt(role.permissions);
 if (
  (permissions & PermissionFlagsBits.Administrator) ===
  PermissionFlagsBits.Administrator
 ) {
  return permissions;
 }

 const overwrites = channel?.permission_overwrites ?? [];
 const applied = [
  overwrites.find((o) => o.type === OverwriteType.Role && o.id === guildId),
  overwrites.find((o) => o.type === OverwriteType.Role && o.id === roleId),
 ];
 applied.forEach((overwrite) => {
  if (!overwrite) return;
  permissions &= ~BigInt(overwrite.deny);
  permissions |= BigInt(overwrite.allow);
 });

 return permissions;
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const userId = getUserOption(sub, InfoOption.User);
 const roleId = getRoleOption(sub, InfoOption.Role);
 const channelId = getChannelOption(sub, InfoOption.Channel);
 if ((userId === null) === (roleId === null)) {
  respondError.call(this, cmd, t.permissions.pickOne());
  return;
 }

 const target = userId ? `<@${userId}>` : `<@&${roleId}>`;

 if (channelId) {
  const allow = userId
   ? (await getChannelPerms.call(this.client.cache, cmd.guild_id, userId, channelId)).allow
   : await roleChannelPerms.call(this, cmd.guild_id, roleId as string, channelId);

  respond.call(
   this,
   cmd,
   [
    permsContainer(
     emotes,
     t,
     t.permissions.inChannel({ target, channel: `<#${channelId}>` }),
     allow,
    ),
   ],
   true,
  );
  return;
 }

 const allow = userId
  ? (await getGuildPerms.call(this.client.cache, cmd.guild_id, userId)).response
  : BigInt((await this.client.cache.roles.get(roleId as string))?.permissions ?? 0);

 respond.call(
  this,
  cmd,
  [permsContainer(emotes, t, t.permissions.serverWide({ target }), allow)],
  true,
 );
}

export const basicPerms = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const [targetId] = args;
 if (!targetId) return;

 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);
 const { response } = await getGuildPerms.call(this.client.cache, cmd.guild_id, targetId);

 respond.call(
  this,
  cmd,
  [permsContainer(emotes, t, t.permissions.serverWide({ target: `<@${targetId}>` }), response)],
  true,
 );
};

export const permsSelect = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.ChannelSelect) return;

 const [targetId, target] = args;
 const [channelId] = cmd.data.values;
 if (!targetId || !channelId) return;

 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const allow =
  target === PermsTarget.Role
   ? await roleChannelPerms.call(this, cmd.guild_id, targetId, channelId)
   : (await getChannelPerms.call(this.client.cache, cmd.guild_id, targetId, channelId)).allow;

 const mention = target === PermsTarget.Role ? `<@&${targetId}>` : `<@${targetId}>`;

 respond.call(
  this,
  cmd,
  [
   permsContainer(
    emotes,
    t,
    t.permissions.inChannel({ target: mention, channel: `<#${channelId}>` }),
    allow,
   ),
  ],
  true,
 );
};
