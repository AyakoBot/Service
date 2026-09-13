import { createBotTokenTransform } from '../../../Util/botTokenTransform.js';
import type EconomyPlugin from '../Plugin.js';

export const economyBotTokenTransform = createBotTokenTransform(async (plugin) => {
 const t = await (plugin as EconomyPlugin).t(null);

 return { invalid: t.botToken.invalid, keyMissing: t.botToken.keyMissing };
});
