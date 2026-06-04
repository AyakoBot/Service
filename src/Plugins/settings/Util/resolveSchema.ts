import type { GatewayDispatchEvents } from '@discordjs/core';

import type { BaseLanguage } from '../../../Classes/abstracts/Plugin.js';
import type Plugin from '../../../Classes/abstracts/Plugin.js';
import type Client from '../../../Classes/Client.js';
import type { SettingsSchema } from '../SettingsSchema.js';

export const resolveSchema = (
 client: Client,
 settingName: string,
): { plugin: Plugin<GatewayDispatchEvents, BaseLanguage>; schema: SettingsSchema } | null => {
 const plugin = client.plugins.find((p) => p.settingName === settingName);
 if (!plugin || !plugin.settingsSchema) return null;
 return { plugin, schema: plugin.settingsSchema };
};
