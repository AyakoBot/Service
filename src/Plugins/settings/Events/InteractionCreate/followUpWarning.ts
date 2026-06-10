import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type SettingsPlugin from '../../Plugin.js';

export const followUpWarning = async function (
 this: SettingsPlugin,
 cmd: APIInteraction,
 content: string,
) {
 if (!cmd.guild_id) return;

 const api = await this.getAPI(cmd.guild_id);
 await api.interactions.followUp(
  cmd.token,
  { content, flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Settings field warning' },
 );
};
