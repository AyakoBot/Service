import { RequestHandlerError, type API } from '@ayako/api';
import { ShopSurface, type CustomRole, type RoleReward } from '@ayako/database';
import type { GuildFeature } from '@discordjs/core';
import {
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { commandMentions, type CommandMention } from '../../../Util/commandMention.js';
import { RoleWritePriority } from '../../../Util/roleWriteQueue.js';
import { EconomyCommand } from '../../economy/Classes/Commands.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';
import {
 CustomRoleColorSubcommand,
 CustomRoleCommand,
 CustomRoleGroup,
 CustomRoleSubcommand,
} from '../Classes/Commands.js';
import { CustomRolesReason, origin } from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
import type { CustomRolesTranslator } from '../Plugin.js';

import { mergeCapabilities, type RewardCapabilities } from './eligibility.js';

export type CustomRoleInteraction =
 | APIChatInputApplicationCommandInteraction
 | APIMessageComponentInteraction
 | APIModalSubmitInteraction;

export interface CustomRoleSurface {
 guildId: string;
 userId: string;
 roleIds: string[];
 displayName: string;
 t: CustomRolesTranslator;
 api: API;
 mention: CommandMention;
 capabilities: RewardCapabilities;
 applying: RoleReward[];
 limits: string;
}

const surfaceReason = 'Custom-Role command';

const subcommandPath = (...parts: string[]): string =>
 [CustomRoleCommand.CustomRole, ...parts].join(' ');

export const createPath = subcommandPath(CustomRoleSubcommand.Create);
export const editNamePath = subcommandPath(CustomRoleSubcommand.EditName);

export const respondEphemeral = function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 content: string,
): ReturnType<MessagePayload['reply']> {
 return new MessagePayload(this.client, { origin, reason: surfaceReason })
  .setContent(content)
  .setAllowedMentionsRoles([])
  .setAllowedMentionsUsers([])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

export const hasFeature = async function (
 this: CustomRolesPlugin,
 guildId: string,
 feature: GuildFeature,
): Promise<boolean> {
 const guild = await this.client.cache.guilds.get(guildId);
 return !!guild?.features.includes(feature);
};

const limitsBlock = (
 t: CustomRolesTranslator,
 emotes: EmoteSet,
 mention: CommandMention,
 capabilities: RewardCapabilities,
): string => {
 const mark = (allowed: boolean) => textEmote(allowed ? emotes.enabled : emotes.disabled);
 const colorPath = (leaf: CustomRoleColorSubcommand) =>
  mention(subcommandPath(CustomRoleGroup.EditColor, leaf));

 return t.customRole.limits({
  icon: mark(capabilities.canSetIcon),
  color: mark(capabilities.canSetColor),
  gradient: mark(capabilities.canSetGradient),
  holo: mark(capabilities.canSetHolo),
  iconCommand: mention(subcommandPath(CustomRoleSubcommand.EditIcon)),
  colorCommand: colorPath(CustomRoleColorSubcommand.Solid),
  gradientCommand: colorPath(CustomRoleColorSubcommand.Gradient),
  holoCommand: colorPath(CustomRoleColorSubcommand.Holographic),
 });
};

const actorOf = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
): Promise<{ userId: string; roleIds: string[]; displayName: string }> {
 const user = cmd.member?.user ?? cmd.user;
 const userId = user?.id ?? '';
 const member = cmd.member ?? (await this.client.cache.members.get(guildId, userId));

 return {
  userId,
  roleIds: member?.roles ?? [],
  displayName: member?.nick || user?.global_name || user?.username || userId,
 };
};

const buyHint = async (
 t: CustomRolesTranslator,
 client: Client,
 guildId: string,
 rewardIds: string[],
 mention: CommandMention,
): Promise<string | null> => {
 if (!rewardIds.length) return null;

 const gates = await client.db.client.economyRoleReward.findMany({
  where: { guild: guildId, active: true, buyPrice: { gt: 0 }, customRoleReward: { in: rewardIds } },
 });
 if (!gates.length) return null;

 const links = gates
  .filter((gate) => gate.shopType === ShopSurface.panel && gate.panelChannel && gate.panelMessage)
  .map((gate) => constants.formatters.msgURL(guildId, gate.panelChannel!, gate.panelMessage!));

 if (links.length) return t.customRole.buyPanel({ links: links.join(' ') });

 return gates.some((gate) => gate.shopType === ShopSurface.command)
  ? t.customRole.buyCommand({ command: mention(EconomyCommand.Shop) })
  : null;
};

export const openSurface = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 guildId: string,
): Promise<CustomRoleSurface | null> {
 const t = await this.t(guildId);
 const { userId, roleIds, displayName } = await actorOf.call(this, cmd, guildId);
 if (!userId) return null;

 const rows = await this.rewards.rowsFor(guildId);
 if (!rows.some((row) => row.active && row.customRole)) {
  await respondEphemeral.call(this, cmd, t.customRole.notEnabled());
  return null;
 }

 const applying = await this.rewards.resolveApplying(guildId, roleIds, userId, rows);
 const capabilities = mergeCapabilities(applying);

 if (!capabilities.customRole) {
  const gateApi = await this.getAPI(guildId);
  const gateMention = await commandMentions.call(gateApi);
  const hint = await buyHint(
   t,
   this.client,
   guildId,
   rows.filter((row) => row.customRole).map((row) => row.id),
   gateMention,
  );

  await respondEphemeral.call(
   this,
   cmd,
   hint
    ? `${t.customRole.cantSet()}
${hint}`
    : t.customRole.cantSet(),
  );
  return null;
 }

 const api = await this.getAPI(guildId);
 const mention = await commandMentions.call(api);

 return {
  guildId,
  userId,
  roleIds,
  displayName,
  t,
  api,
  mention,
  capabilities,
  applying,
  limits: limitsBlock(t, this.client.emojis.for(api), mention, capabilities),
 };
};

export const refuse = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 reason: string,
): Promise<void> {
 await respondEphemeral.call(this, cmd, `${reason}\n\n${surface.limits}`);
};

export const succeed = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 headline: string,
 notes: string[] = [],
): Promise<void> {
 await respondEphemeral.call(this, cmd, `${[headline, ...notes].join('\n')}\n\n${surface.limits}`);
};

export const requireRole = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
): Promise<CustomRole | null> {
 const row = await this.roles.rowFor(surface.guildId, surface.userId);
 const role = row ? await this.client.cache.roles.get(row.role) : null;
 if (row && role) return row;

 await refuse.call(
  this,
  cmd,
  surface,
  surface.t.customRole.notExists({ command: surface.mention(createPath) }),
 );
 return null;
};

export const grantRole = function (
 this: CustomRolesPlugin,
 surface: CustomRoleSurface,
 roleId: string,
): void {
 this.client.roleWrites.enqueue({
  guildId: surface.guildId,
  userId: surface.userId,
  add: [roleId],
  reason: CustomRolesReason.Grant,
  priority: RoleWritePriority.Interactive,
 });
};

export const reassertAnchor = async function (
 this: CustomRolesPlugin,
 surface: CustomRoleSurface,
 roleId: string,
): Promise<string[]> {
 const anchorId = await this.rewards.anchorFor(surface.guildId, surface.applying);
 if (!anchorId) return [];

 const anchor = await this.client.cache.roles.get(anchorId);
 if (!anchor) return [surface.t.errors.repositionFailed()];

 const moved = await surface.api.guilds.setRolePositions(
  surface.guildId,
  [{ id: roleId, position: anchor.position }],
  { origin, reason: CustomRolesReason.Manage },
 );

 if (moved instanceof RequestHandlerError) {
  this.nonFatalError(moved, 'customRoles.anchor');
  return [surface.t.errors.repositionFailed()];
 }

 return [];
};
