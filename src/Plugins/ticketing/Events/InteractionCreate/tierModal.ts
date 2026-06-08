import type { TicketTier } from '@ayako/database';
import {
 ChannelSelectMenuBuilder,
 LabelBuilder,
 ModalBuilder,
 RoleSelectMenuBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 ChannelType,
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { formatDurationSeconds, parseDurationSeconds } from '../../../../Util/durationSeconds.js';
import { TierErrors } from '../../Classes/Enums.js';
import { TicketRoute } from '../../Classes/Routes.js';
import TicketTierEntry, { type TierInput } from '../../Classes/TicketTierEntry.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import { findModalValue, findModalValues } from '../../Util/findModalValue.js';

import { buildTierEditor } from './tierManage.js';

const tierModal = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 settingsId: string,
 tier: TicketTier | null,
) {
 const t = await this.t(cmd.guild_id ?? undefined);

 const customId = tier
  ? this.getRoute(TicketRoute.TierSave, settingsId, tier.id)
  : this.getRoute(TicketRoute.TierSave, settingsId);

 const nameInput = new TextInputBuilder()
  .setCustomId('name')
  .setStyle(TextInputStyle.Short)
  .setRequired(true)
  .setMaxLength(80);
 if (tier) nameInput.setValue(tier.name);

 const reminderInput = new TextInputBuilder()
  .setCustomId('reminderSeconds')
  .setStyle(TextInputStyle.Short)
  .setRequired(false)
  .setPlaceholder('e.g. 30m, 2h, 1h 30m')
  .setMaxLength(32);
 if (tier && Number(tier.reminderSeconds) > 0) {
  reminderInput.setValue(formatDurationSeconds(Number(tier.reminderSeconds)));
 }

 const rolesSelect = new RoleSelectMenuBuilder().setCustomId('claimRoles').setMinValues(0).setMaxValues(25);
 if (tier?.claimRoles.length) rolesSelect.setDefaultRoles(tier.claimRoles);

 const categorySelect = new ChannelSelectMenuBuilder()
  .setCustomId('category')
  .setChannelTypes([ChannelType.GuildCategory])
  .setMinValues(0)
  .setMaxValues(1);
 if (tier?.category) categorySelect.setDefaultChannels([tier.category]);

 const channelSelect = new ChannelSelectMenuBuilder()
  .setCustomId('channel')
  .setChannelTypes([ChannelType.GuildText, ChannelType.GuildForum])
  .setMinValues(0)
  .setMaxValues(1);
 if (tier?.channel) channelSelect.setDefaultChannels([tier.channel]);

 const modal = new ModalBuilder()
  .setCustomId(customId)
  .setTitle(tier ? t.tierEditor.editTitle() : t.tierEditor.addTitle())
  .addLabelComponents(
   new LabelBuilder().setLabel(t.base.t.name()).setTextInputComponent(nameInput),
   new LabelBuilder()
    .setLabel(t.tierEditor.claimRoles())
    .setRoleSelectMenuComponent(rolesSelect),
   new LabelBuilder()
    .setLabel(t.tierEditor.reminderSeconds())
    .setDescription(t.tierEditor.reminderHint())
    .setTextInputComponent(reminderInput),
   new LabelBuilder()
    .setLabel(t.settings.fields.category())
    .setChannelSelectMenuComponent(categorySelect),
   new LabelBuilder()
    .setLabel(t.settings.fields.channel())
    .setChannelSelectMenuComponent(channelSelect),
  );

 const api = await this.getAPI(cmd.guild_id ?? '');
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening tier editor modal',
 });
};

export const tierAdd = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 await tierModal.call(this, cmd, args[0], null);
};

export const tierEdit = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId, tierId] = args;
 const tier = await new TicketTierEntry(this.client, settingsId).byId(tierId);
 if (!tier) {
  tierWarn.call(this, cmd, (await this.t(cmd.guild_id)).tierEditor.errors.notFound());
  return;
 }

 await tierModal.call(this, cmd, settingsId, tier);
};

export const tierSave = async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const [settingsId, tierId] = args;
 const entry = new TicketTierEntry(this.client, settingsId);

 const settings = await this.client.db.client.ticketSetting.findUnique({
  where: { id: settingsId },
 });
 if (!settings) {
  tierWarn.call(this, cmd, t.errors.settingsNotFound());
  return;
 }

 const name = (findModalValue(cmd.data.components, 'name') || '').trim();
 if (!name) {
  tierWarn.call(this, cmd, t.tierEditor.errors.nameRequired());
  return;
 }

 const reminderSeconds = parseDurationSeconds(
  findModalValue(cmd.data.components, 'reminderSeconds') ?? '',
 );
 if (reminderSeconds === null) {
  tierWarn.call(this, cmd, t.base.errors.invalidDuration());
  return;
 }

 const input: TierInput = {
  name,
  claimRoles: findModalValues(cmd.data.components, 'claimRoles'),
  category: findModalValues(cmd.data.components, 'category')[0] ?? null,
  channel: findModalValues(cmd.data.components, 'channel')[0] ?? null,
  reminderSeconds,
 };

 const result = await (tierId ? entry.edit(settings, tierId, input) : entry.create(settings, input))
  .then(() => null)
  .catch((error: Error) => error);

 if (result) {
  tierWarn.call(this, cmd, translateTierError.call(this, t, result));
  return;
 }

 const tiers = await entry.list();
 const payload = await buildTierEditor.call(this, cmd.guild_id, settingsId, tiers, 0);
 payload.reply(cmd);
};

const translateTierError = function (
 this: TicketPlugin,
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 error: Error,
): string {
 switch (error.message) {
  case TierErrors.forumTagBudget:
   return t.tierEditor.errors.forumTagBudget();
  case TierErrors.notFound:
   return t.tierEditor.errors.notFound();
  case TierErrors.nameRequired:
   return t.tierEditor.errors.nameRequired();
  default:
   this.nonFatalError(error, 'tierSave');
   return t.tierEditor.errors.saveFailed();
 }
};

const tierWarn = function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Tier editor warning' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
