import type { SettingsOption } from '../../settings/SettingsSchema.js';
import type ComponentBuilderPlugin from '../Plugin.js';

export const designChoices = async function (
 this: ComponentBuilderPlugin,
 guildId: string,
): Promise<SettingsOption[]> {
 const t = await this.t(guildId);
 const rows = await this.client.db.client.customComponents.findMany({
  where: { guild: guildId },
  select: { id: true, name: true },
 });

 return rows.map((row) => ({ label: row.name || t.settings.unnamed(), value: String(row.id) }));
};
