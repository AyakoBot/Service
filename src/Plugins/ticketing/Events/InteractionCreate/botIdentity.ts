import { decrypt, getBotIdFromToken } from '@ayako/utility';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
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

export const clearBotToken = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId] = args;
 const t = await this.t(cmd.guild_id);

 await this.client.db.client.ticketSetting.updateMany({
  where: { id: settingsId, guild: cmd.guild_id },
  data: { botToken: null },
 });
 this.invalidateGuildAPI(cmd.guild_id);
 this.reconcileSatellites();

 reply.call(this, cmd, t.settings.botTokenCleared());
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
