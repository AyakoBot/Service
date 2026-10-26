import { PluginName, SettingsCategory } from '../../../Classes/abstracts/Plugin.js';
import { settingsCommandName } from '../../../Util/buildCommandBody.js';
import commandMention from '../../../Util/commandMention.js';
import type GiveawaysPlugin from '../Plugin.js';
import type { GiveawaysTranslator } from '../Plugin.js';

export const missingDefaultsText = async function (
 this: GiveawaysPlugin,
 t: GiveawaysTranslator,
 guildId: string,
 error: Error,
): Promise<string> {
 const missing = Array.isArray(error.cause) ? error.cause.map(String) : [];
 const command = await commandMention.call(
  await this.getAPI(guildId),
  `${settingsCommandName} ${SettingsCategory.Fun} ${PluginName.Giveaways}`,
 );

 return t.errors.missingDefaults({
  options: missing.map((option) => `\`${option}\``).join(', '),
  command,
 });
};
