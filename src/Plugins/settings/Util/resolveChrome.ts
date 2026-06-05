import type SettingsPlugin from '../Plugin.js';

import type { NavigatorChrome } from './buildNavigator.js';

export const resolveChrome = async function (
 this: SettingsPlugin,
 guildId: string,
): Promise<NavigatorChrome> {
 const t = await this.t(guildId);
 return {
  back: t.navigator.back(),
  pause: t.navigator.pause(),
  resume: t.navigator.resume(),
  del: t.base.t.Delete(),
  incomplete: t.navigator.incomplete(),
 };
};
