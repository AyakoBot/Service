import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type ConfessionsPlugin from '../Plugin.js';

const original = '@original';

export const deferConfession = async function (
 this: ConfessionsPlugin,
 cmd: APIInteraction,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.interactions.defer(
  cmd.id,
  cmd.token,
  { flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Confession interaction' },
 );
};

export const note = async function (
 this: ConfessionsPlugin,
 cmd: APIInteraction,
 content: string,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  original,
  { content, allowed_mentions: { parse: [] } },
  { origin: this.name, reason: 'Confession interaction' },
 );
};
