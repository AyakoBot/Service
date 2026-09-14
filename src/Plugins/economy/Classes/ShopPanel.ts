import { RequestHandlerError } from '@ayako/api';
import { ShopButtonStyle, type EconomyRoleReward } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessageComponentEmoji,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { parseEmojiInput } from '../../../Util/emojiInput.js';
import type { ShowIfResult } from '../../settings/SettingsSchema.js';
import type EconomyPlugin from '../Plugin.js';

import { EconomyRoute } from './Routes.js';

const styles: Record<ShopButtonStyle, ButtonStyle> = {
 [ShopButtonStyle.primary]: ButtonStyle.Primary,
 [ShopButtonStyle.secondary]: ButtonStyle.Secondary,
 [ShopButtonStyle.success]: ButtonStyle.Success,
 [ShopButtonStyle.danger]: ButtonStyle.Danger,
};

export default class ShopPanel {
 plugin: EconomyPlugin;
 client: Client;

 constructor(plugin: EconomyPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 private emoji = (row: EconomyRoleReward): APIMessageComponentEmoji | undefined => {
  if (!row.panelButtonEmote) return undefined;

  const parsed = parseEmojiInput(row.panelButtonEmote);
  if (!parsed) return undefined;

  return parsed.id
   ? { id: parsed.id, name: parsed.name, animated: parsed.animated }
   : { name: parsed.name };
 };

 private button = (row: EconomyRoleReward, label: string): ButtonBuilder => {
  const button = new ButtonBuilder()
   .setStyle(styles[row.panelButtonStyle])
   .setCustomId(this.plugin.getRoute(EconomyRoute.ShopBuy, row.id))
   .setLabel((row.panelButtonText || label).slice(0, 80));

  const emoji = this.emoji(row);

  return emoji ? button.setEmoji(emoji) : button;
 };

 payload = async (row: EconomyRoleReward): Promise<MessagePayload> => {
  const t = await this.plugin.t(row.guild);

  const container = new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `## ${t.settings.rewards.panelTitle()}
${t.settings.rewards.panelBody()}`,
    ),
   )
   .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     this.button(row, t.settings.rewards.panelTitle()),
    ),
   );

  return new MessagePayload(this.client, {
   origin: this.plugin.name,
   reason: 'Economy shop panel',
  })
   .setComponents([container.toJSON() as APIMessageTopLevelComponent])
   .setFlags(MessageFlags.IsComponentsV2);
 };

 private retire = async (row: EconomyRoleReward, nextChannelId: string): Promise<void> => {
  if (!row.panelChannel || !row.panelMessage) return;
  if (row.panelChannel === nextChannelId) return;

  const api = await this.plugin.getAPI(row.guild);

  await api.channels
   .deleteMessage(row.panelChannel, row.panelMessage, {
    origin: this.plugin.name,
    reason: 'Economy shop panel moved',
   })
   .catch(() => null);
 };

 post = async (row: EconomyRoleReward, channelId: string): Promise<ShowIfResult> => {
  const t = await this.plugin.t(row.guild);
  const channel = `<#${channelId}>`;

  if (!row.active) return { ok: false, reason: t.settings.rewards.needsActive() };
  if (row.buyPrice <= 0) return { ok: false, reason: t.settings.rewards.needsPrice() };

  const api = await this.plugin.getAPI(row.guild);
  const payload = await this.payload(row);

  if (row.panelChannel === channelId && row.panelMessage) {
   const edited = await payload.edit(channelId, row.panelMessage, row.guild, api).catch(() => null);

   if (edited && !(edited instanceof RequestHandlerError)) {
    return { ok: true, reason: t.settings.rewards.posted({ channel }) };
   }
  }

  const sent = await payload
   .setAPI(api)
   .setSendTo([{ channel: channelId, guildId: row.guild }])
   .send()
   .then((messages) => messages[0])
   .catch(() => null);

  if (!sent || sent instanceof RequestHandlerError) {
   return { ok: false, reason: t.settings.rewards.postFailed({ channel }) };
  }

  await this.retire(row, channelId);

  await this.client.db.client.economyRoleReward.updateMany({
   where: { id: row.id, guild: row.guild },
   data: { panelChannel: channelId, panelMessage: sent.id },
  });

  return { ok: true, reason: t.settings.rewards.posted({ channel }) };
 };
}
