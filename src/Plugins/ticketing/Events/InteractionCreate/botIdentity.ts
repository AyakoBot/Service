import { TicketState } from '@ayako/database';
import { decrypt, getBotIdFromToken } from '@ayako/utility';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { TicketRoute } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';

const reply = function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 content: string,
 components: APIMessageTopLevelComponent[] = [],
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Bot identity action' })
  .setContent(content)
  .setComponents(components)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const update = function (this: TicketPlugin, cmd: APIMessageComponentInteraction, content: string) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Bot identity action' })
  .setContent(content)
  .setComponents([])
  .setFlags(MessageFlags.Ephemeral)
  .update(cmd);
};

export const clearBotToken = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId] = args;
 if (!settingsId) return;

 const t = await this.t(cmd.guild_id);

 const stranded = await this.client.db.client.ticket.count({
  where: {
   settingsId,
   dm: { not: null },
   state: { in: [TicketState.opened, TicketState.claimed] },
  },
 });

 const warning = stranded
  ? t.settings.clearTokenWarnTickets({ count: String(stranded) })
  : t.settings.clearTokenWarn();

 const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Danger)
   .setLabel(t.settings.clearTokenConfirmLabel())
   .setCustomId(this.getRoute(TicketRoute.ClearBotTokenConfirm, settingsId)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.base.t.Cancel())
   .setCustomId(this.getRoute(TicketRoute.ClearBotTokenCancel)),
 );

 reply.call(this, cmd, warning, [buttons.toJSON() as unknown as APIMessageTopLevelComponent]);
};

export const clearBotTokenConfirm = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId] = args;
 if (!settingsId) return;

 const t = await this.t(cmd.guild_id);

 await this.client.db.client.ticketSetting.updateMany({
  where: { id: settingsId, guild: cmd.guild_id },
  data: { botToken: null },
 });
 this.invalidateGuildAPI(cmd.guild_id);
 this.reconcileSatellites();

 update.call(this, cmd, t.settings.botTokenCleared());
};

export const clearBotTokenCancel = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 update.call(this, cmd, t.settings.clearTokenCancelled());
};

export const inviteBot = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId] = args;
 const t = await this.t(cmd.guild_id);
 const row = await this.client.db.client.ticketSetting.findFirst({
  where: { id: settingsId, guild: cmd.guild_id },
 });

 if (!row?.botToken) {
  reply.call(this, cmd, t.settings.inviteBotNoToken());
  return;
 }

 let botId: string;
 try {
  botId = getBotIdFromToken(decrypt(row.botToken));
 } catch (error) {
  this.nonFatalError(error as Error, `${this.name} inviteBot botId`);
  reply.call(this, cmd, t.botToken.invalid());
  return;
 }

 const url = `https://discord.com/oauth2/authorize?client_id=${botId}&permissions=${this.customBotPerms.toString()}&scope=bot+applications.commands`;

 const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Link)
   .setURL(url)
   .setLabel(t.settings.inviteBotLabel()),
 );

 reply.call(this, cmd, t.settings.inviteBotText(), [
  inviteRow.toJSON() as unknown as APIMessageTopLevelComponent,
 ]);
};
