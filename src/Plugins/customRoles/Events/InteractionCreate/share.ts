import {
 ActionRowBuilder,
 ButtonBuilder,
 UserSelectMenuBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from '@discordjs/core';
import type {
 APIApplicationCommandAutocompleteInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
 APIMessageComponentInteraction,
 APIMessageTopLevelComponent,
} from 'discord-api-types/v10';
import { MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import {
 findFocusedString,
 getStringOption,
} from '../../../../Util/interactionOptions.js';
import { RoleWritePriority } from '../../../../Util/roleWriteQueue.js';
import { selectOptionLimit } from '../../../componentBuilder/Classes/Nodes.js';
import { buttonEmoji } from '../../../settings/Util/settingsEmotes.js';
import { CustomRoleCommand, CustomRoleOption } from '../../Classes/Commands.js';
import { CustomRolesRoute } from '../../Classes/Routes.js';
import { MAX_SHARE_LIMIT } from '../../Classes/settingsSchema.js';
import { CustomRolesReason, origin } from '../../constants.js';
import type CustomRolesPlugin from '../../Plugin.js';
import type { CustomRolesTranslator } from '../../Plugin.js';
import { denied, mergeCapabilities } from '../../Util/eligibility.js';
import {
 openSurface,
 refuse,
 respondEphemeral,
 type CustomRoleInteraction,
 type CustomRoleSurface,
} from '../../Util/surface.js';

const shareReason = 'Custom-Role sharing';

const clampShare = (maxShare: number): number => Math.max(1, Math.min(MAX_SHARE_LIMIT, maxShare));

const shareComponents = function (
 this: CustomRolesPlugin,
 t: CustomRolesTranslator,
 emotes: EmoteSet,
 maxShare: number,
 shared: string[],
): APIMessageTopLevelComponent[] {
 const limit = clampShare(maxShare);

 return [
  new ActionRowBuilder<UserSelectMenuBuilder>()
   .addComponents(
    new UserSelectMenuBuilder()
     .setCustomId(this.getRoute(CustomRolesRoute.Share))
     .setPlaceholder(t.share.placeholder())
     .setMinValues(0)
     .setMaxValues(limit)
     .setDisabled(maxShare < 1)
     .setDefaultUsers(...shared.slice(0, limit)),
   )
   .toJSON(),
  new ActionRowBuilder<ButtonBuilder>()
   .addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(CustomRolesRoute.ShareRefresh))
     .setLabel(t.base.t.Refresh())
     .setEmoji(buttonEmoji(emotes.refresh)),
   )
   .toJSON(),
 ];
};

const renderPanel = async function (
 this: CustomRolesPlugin,
 cmd: CustomRoleInteraction,
 surface: CustomRoleSurface,
 update: boolean,
): Promise<void> {
 const { maxShare } = surface.capabilities;
 if (maxShare < 1) {
  await refuse.call(this, cmd, surface, surface.t.share.cantShare());
  return;
 }

 const row = await this.roles.rowFor(surface.guildId, surface.userId);
 if (!row) {
  await refuse.call(this, cmd, surface, surface.t.share.noRole());
  return;
 }

 const payload = new MessagePayload(this.client, { origin, reason: shareReason })
  .setContent(`## ${surface.t.share.title()}\n${surface.t.share.desc({ amount: String(maxShare) })}`)
  .setAllowedMentionsUsers([])
  .setFlags(MessageFlags.Ephemeral)
  .setComponents(
   shareComponents.call(
    this,
    surface.t,
    this.client.emojis.for(surface.api),
    maxShare,
    row.shared,
   ),
  );

 await (update ? payload.update(cmd) : payload.reply(cmd));
};

export const sharePanel = async function (
 this: CustomRolesPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 guildId: string,
): Promise<void> {
 const surface = await openSurface.call(this, cmd, guildId);
 if (!surface) return;

 await renderPanel.call(this, cmd, surface, false);
};

export const shareRefresh = async function (
 this: CustomRolesPlugin,
 cmd: APIMessageComponentInteraction,
): Promise<void> {
 if (!cmd.guild_id) return;

 const surface = await openSurface.call(this, cmd, cmd.guild_id);
 if (!surface) return;

 await renderPanel.call(this, cmd, surface, true);
};

export const shareSelect = async function (
 this: CustomRolesPlugin,
 cmd: APIMessageComponentInteraction,
 values: string[],
): Promise<void> {
 if (!cmd.guild_id) return;

 const surface = await openSurface.call(this, cmd, cmd.guild_id);
 if (!surface) return;

 if (surface.capabilities.maxShare < 1) {
  await refuse.call(this, cmd, surface, surface.t.share.cantShare());
  return;
 }

 const row = await this.roles.rowFor(surface.guildId, surface.userId);
 if (!row) {
  await refuse.call(this, cmd, surface, surface.t.share.noRole());
  return;
 }

 const shared = values
  .filter((id) => id !== surface.userId)
  .slice(0, clampShare(surface.capabilities.maxShare));

 await this.client.db.client.customRole.updateMany({
  where: { guild: surface.guildId, user: surface.userId },
  data: { shared },
 });

 row.shared
  .filter((id) => !shared.includes(id))
  .forEach((id) =>
   this.client.roleWrites.enqueue({
    guildId: surface.guildId,
    userId: id,
    remove: [row.role],
    reason: CustomRolesReason.PrivilegeLost,
    priority: RoleWritePriority.Automation,
   }),
  );

 await renderPanel.call(this, cmd, surface, true);
};

export const claimShared = async function (
 this: CustomRolesPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
): Promise<void> {
 if (!cmd.guild_id || !cmd.member) return;

 const t = await this.t(cmd.guild_id);
 const roleId = getStringOption(sub, CustomRoleOption.Role);
 const role = roleId ? await this.client.cache.roles.get(roleId) : null;

 if (!role) {
  await respondEphemeral.call(this, cmd, t.share.notFound());
  return;
 }

 const claimantId = cmd.member.user.id;
 const row = await this.client.db.client.customRole.findFirst({
  where: { guild: cmd.guild_id, role: roleId, shared: { has: claimantId } },
 });

 if (!row) {
  await respondEphemeral.call(this, cmd, t.share.notAllowed());
  return;
 }

 const owner = await this.client.cache.members.get(cmd.guild_id, row.user);
 const applying = await this.rewards.resolveApplying(cmd.guild_id, owner?.roles ?? [], row.user);
 const capabilities = mergeCapabilities(applying);
 const slot = row.shared.indexOf(claimantId);

 if (
  !capabilities.customRole ||
  slot >= capabilities.maxShare ||
  denied(applying, cmd.member.roles, claimantId)
 ) {
  await respondEphemeral.call(this, cmd, t.share.notAllowed());
  return;
 }

 const holding = cmd.member.roles.includes(roleId);
 this.client.roleWrites.enqueue({
  guildId: cmd.guild_id,
  userId: claimantId,
  ...(holding ? { remove: [roleId] } : { add: [roleId] }),
  reason: CustomRolesReason.Grant,
  priority: RoleWritePriority.Interactive,
 });

 await respondEphemeral.call(
  this,
  cmd,
  (holding ? t.share.unequip : t.share.claimed)({ role: `<@&${roleId}>` }),
 );
};

export const autocomplete = async function (
 this: CustomRolesPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
): Promise<void> {
 if (!cmd.guild_id || cmd.data.name !== CustomRoleCommand.CustomRole) return;

 const claimantId = cmd.member?.user.id ?? '';
 const rows = await this.client.db.client.customRole.findMany({
  where: { guild: cmd.guild_id, shared: { has: claimantId } },
 });

 const query = findFocusedString(cmd.data.options).toLowerCase();
 const named = await Promise.all(
  rows.map(async (row) => ({
   value: row.role,
   name: (await this.client.cache.roles.get(row.role))?.name ?? '',
  })),
 );

 const choices = named
  .filter((entry) => entry.name && (!query || entry.name.toLowerCase().includes(query)))
  .slice(0, selectOptionLimit)
  .map((entry) => ({ name: entry.name.slice(0, 100), value: entry.value }));

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createAutocompleteResponse(
  cmd.id,
  cmd.token,
  { choices },
  { origin, reason: 'Custom-Role claim autocomplete' },
 );
};
