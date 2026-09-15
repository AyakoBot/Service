import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type EconomyPlugin from '../Plugin.js';

const original = '@original';

export const deferShop = async function (this: EconomyPlugin, cmd: APIInteraction): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.interactions.defer(
  cmd.id,
  cmd.token,
  { flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Shop interaction' },
 );
};

export const shopText = async function (
 this: EconomyPlugin,
 cmd: APIInteraction,
 content: string,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  original,
  { content },
  { origin: this.name, reason: 'Shop interaction' },
 );
};
