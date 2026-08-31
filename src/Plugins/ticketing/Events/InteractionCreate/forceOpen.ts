import {
 ActionRowBuilder,
 ButtonBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import {
 ApplicationCommandType,
 ButtonStyle,
 ComponentType,
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import DmToChannelTicket from '../../Classes/DmToChannelTicket.js';
import { TicketRoute } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';
import { isForceBlocked, setForceBlock } from '../../Util/forceBlock.js';
import getForceOpenableKinds, {
 ForceOpenBlock,
 type ForceOpenCandidate,
} from '../../Util/getForceOpenableKinds.js';
import getTicketClassBySettingsType from '../../Util/getTicketClassBySettingsType.js';
import handleTicketError from '../../Util/handleTicketError.js';
import showCommandError from '../../Util/showCommandError.js';
import { systemDisplayLabel } from '../../Util/systemLabel.js';

type ForceOpenTranslator = Awaited<ReturnType<TicketPlugin['t']>>;

const blockReason = (t: ForceOpenTranslator, block: ForceOpenBlock): string => {
 switch (block) {
  case ForceOpenBlock.NotActive:
   return t.forceOpen.blockNotActive();
  case ForceOpenBlock.NotDmType:
   return t.forceOpen.blockNotDmType();
  case ForceOpenBlock.NoCustomBot:
   return t.forceOpen.blockNoCustomBot();
  case ForceOpenBlock.NotStaff:
   return t.forceOpen.blockNotStaff();
  default:
   return t.forceOpen.blockBotUnavailable();
 }
};

const noSystemsText = (t: ForceOpenTranslator, candidates: ForceOpenCandidate[]): string => {
 const lines = candidates
  .filter((candidate) => !!candidate.block)
  .map(
   (candidate) =>
    `- ${systemDisplayLabel(t, candidate.settings)}: ${blockReason(t, candidate.block!)}`,
  );

 if (!lines.length) return t.forceOpen.noSystems();

 return `${t.forceOpen.noSystems()}\n${lines.join('\n')}`;
};

export const forceOpenCommand = async function (
 this: TicketPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (cmd.data.type !== ApplicationCommandType.User) return;
 if (!cmd.guild_id || !cmd.member) return;

 const t = await this.t(cmd.guild_id);
 const staffId = cmd.member.user.id;
 const targetId = cmd.data.target_id;
 const target = cmd.data.resolved.users[targetId];

 if (!target || target.bot || targetId === staffId) {
  showCommandError.call(this.client, t.forceOpen.targetInvalid(), cmd, t.base);
  return;
 }

 const candidates = await getForceOpenableKinds.call(this, cmd.guild_id, staffId, cmd.member.roles);
 const kinds = candidates.filter((candidate) => !candidate.block).map((c) => c.settings);
 if (!kinds.length) {
  showCommandError.call(this.client, noSystemsText(t, candidates), cmd, t.base);
  return;
 }

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(TicketRoute.ForceOpenKind, targetId))
  .setPlaceholder(t.forceOpen.pickSystem({ user: target.username }).slice(0, 150))
  .setMinValues(1)
  .setMaxValues(1)
  .setOptions(
   kinds
    .slice(0, 25)
    .map((setting) =>
     new StringSelectMenuOptionBuilder()
      .setLabel(systemDisplayLabel(t, setting).slice(0, 100))
      .setValue(String(setting.id)),
    ),
  );

 new MessagePayload(this.client, { origin: this.name, reason: 'Picking a force-open system' })
  .setContent(t.forceOpen.pickSystem({ user: `<@${targetId}>` }))
  .setComponents([
   new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(select)
    .toJSON() as unknown as APIMessageTopLevelComponent,
  ])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

export const forceOpenKind = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (!cmd.guild_id || !cmd.member) return;

 const [targetId] = args;
 const [settingsId] = cmd.data.values;
 if (!targetId || !settingsId) return;

 const t = await this.t(cmd.guild_id);
 const staffId = cmd.member.user.id;

 const candidates = await getForceOpenableKinds.call(this, cmd.guild_id, staffId, cmd.member.roles);
 const settings = candidates
  .filter((candidate) => !candidate.block)
  .map((candidate) => candidate.settings)
  .find((kind) => String(kind.id) === settingsId);
 if (!settings) {
  showCommandError.call(this.client, noSystemsText(t, candidates), cmd, t.base);
  return;
 }

 if (await isForceBlocked.call(this.client, cmd.guild_id, targetId)) {
  showCommandError.call(this.client, t.forceOpen.blockedNote(), cmd, t.base);
  return;
 }

 const member = await this.client.cache.members.get(cmd.guild_id, targetId);
 const user = await this.client.cache.users.get(targetId);

 const ticket = getTicketClassBySettingsType.call(
  this.client,
  settings.type,
  '0',
 ) as DmToChannelTicket;

 const create = ticket.create(
  { settingsId, userId: targetId, opener: staffId },
  { cmd, userId: targetId, roleIds: member?.roles ?? [], username: user?.username || targetId },
 );

 create
  .next()
  .catch((error: Error) =>
   handleTicketError.call(this.client, { guildId: cmd.guild_id!, error, cmd }),
  );
};

export const forceBlock = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ticket = await DmToChannelTicket.findTicketByDMChannelId(this.client, cmd.channel.id);
 if (!ticket) return;

 const row = await ticket.getTicket();
 const t = await this.t(row.settings.guild);

 const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Danger)
   .setCustomId(this.getRoute(TicketRoute.ForceBlockConfirm))
   .setLabel(t.forceOpen.blockConfirm()),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.ForceBlockCancel))
   .setLabel(t.base.t.Cancel()),
 );

 new MessagePayload(this.client, { origin: this.name, reason: 'Confirming a force-open block' })
  .setContent(t.forceOpen.blockWarning())
  .setComponents([buttons.toJSON() as unknown as APIMessageTopLevelComponent])
  .update(cmd);
};

export const forceBlockCancel = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ticket = await DmToChannelTicket.findTicketByDMChannelId(this.client, cmd.channel.id);
 if (!ticket) return;

 const row = await ticket.getTicket();
 const t = await this.t(row.settings.guild);

 new MessagePayload(this.client, { origin: this.name, reason: 'Cancelling a force-open block' })
  .setContent(t.forceOpen.blockCancelled())
  .setComponents([])
  .update(cmd);
};

export const forceBlockConfirm = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ticket = await DmToChannelTicket.findTicketByDMChannelId(this.client, cmd.channel.id);
 if (!ticket) return;

 const row = await ticket.getTicket();
 const t = await this.t(row.settings.guild);

 await setForceBlock.call(this.client, row.settings.guild, row.user);

 new MessagePayload(this.client, { origin: this.name, reason: 'Blocking forced tickets' })
  .setContent(t.forceOpen.blocked())
  .setComponents([])
  .update(cmd);

 await ticket
  .autoClose({
   reason: t.forceOpen.blockedStaffNote(),
   heading: t.forceOpen.closedByMember(),
  })
  .catch((error: Error) => this.nonFatalError(error, 'forceBlockConfirm'));
};
