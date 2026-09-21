import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type EconomyPlugin from '../Plugin.js';

const original = '@original';

type EditBody = Parameters<
 Awaited<ReturnType<EconomyPlugin['getAPI']>>['webhooks']['editMessage']
>[3];

export const deferEconomy = async function (
 this: EconomyPlugin,
 cmd: APIInteraction,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.interactions.defer(
  cmd.id,
  cmd.token,
  { flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Economy interaction' },
 );
};

export const editOriginal = async function (
 this: EconomyPlugin,
 cmd: APIInteraction,
 body: EditBody,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');

 await api.webhooks.editMessage(
  cmd.application_id,
  cmd.token,
  original,
  { allowed_mentions: { parse: [] }, with_components: true, ...body },
  { origin: this.name, reason: 'Economy interaction' },
 );
};

export default function (this: EconomyPlugin, cmd: APIInteraction, content: string): void {
 void editOriginal.call(this, cmd, { content });
}
