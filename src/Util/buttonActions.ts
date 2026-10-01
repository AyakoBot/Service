import type { OptionsResolver } from '../Plugins/settings/SettingsSchema.js';

export interface ButtonAction {
 route: string;
 label: (guildId: string) => Promise<string>;
 choices?: OptionsResolver;
}
