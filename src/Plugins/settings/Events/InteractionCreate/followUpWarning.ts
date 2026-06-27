import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';

export const followUpWarning = async function (
 this: SettingsPlugin,
 cmd: APIInteraction,
 content: string,
) {
 if (!cmd.guild_id) return;

 await this.client.getBaseAPI().webhooks.execute(
  cmd.application_id,
  cmd.token,
  { content, flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Settings field warning' },
 );
};
