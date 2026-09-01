import { logger } from '@ayako/utility';
import { config } from 'dotenv';

import type Client from '../Classes/Client.js';

import { hasMessageContentIntent } from './messageContentIntent.js';

export default async function registerCommandsSetup(tag: string) {
 config({ path: '../../.env', quiet: true });

 // eslint-disable-next-line @typescript-eslint/naming-convention
 const { default: ClientClass } = await import('../Classes/Client.js');
 const { default: pluginAFK } = await import('../Plugins/afk/Plugin.js');
 const { default: pluginFilterScraper } = await import('../Plugins/filterScraper/Plugin.js');
 const { default: pluginSettings } = await import('../Plugins/settings/Plugin.js');
 const { default: pluginCustomClients } = await import('../Plugins/customClients/Plugin.js');
 const { default: pluginTicketing } = await import('../Plugins/ticketing/Plugin.js');
 const { default: pluginEval } = await import('../Plugins/eval/Plugin.js');
 const { default: pluginEmbedBuilder } = await import('../Plugins/embedBuilder/Plugin.js');
 const { default: pluginComponentBuilder } = await import('../Plugins/componentBuilder/Plugin.js');
 const { default: pluginInfo } = await import('../Plugins/info/Plugin.js');
 const { default: pluginWelcome } = await import('../Plugins/welcome/Plugin.js');
 const { default: buildCommandBody } = await import('./buildCommandBody.js');

 const client: Client = new ClientClass();
 client.registerPlugin(pluginAFK);
 client.registerPlugin(pluginFilterScraper);
 client.registerPlugin(pluginSettings);
 client.registerPlugin(pluginCustomClients);
 client.registerPlugin(pluginTicketing);
 client.registerPlugin(pluginEval);
 client.registerPlugin(pluginEmbedBuilder);
 client.registerPlugin(pluginComponentBuilder);
 client.registerPlugin(pluginInfo);
 client.registerPlugin(pluginWelcome);

 const pluginName = process.argv
  .find((arg) => arg.startsWith('--plugin='))
  ?.slice('--plugin='.length)
  .trim();

 const onlyPlugin = pluginName
  ? client.plugins.find(
     (p) => p.settingName === pluginName || p.name.toLowerCase() === pluginName.toLowerCase(),
    )
  : undefined;

 if (pluginName && !onlyPlugin) {
  logger.error(`${tag} Plugin "${pluginName}" not found`);
  process.exit(1);
 }

 const registerToken = process.argv
  .find((arg) => arg.startsWith('--token='))
  ?.slice('--token='.length)
  .trim();

 const activeToken = registerToken
  ? (process.env[registerToken] ?? '')
  : (process.env.Token ?? '');

 const messageContent = activeToken ? await hasMessageContentIntent(activeToken) : true;
 client.plugins.forEach((plugin) => {
  if ('hasMessageContent' in plugin) {
   Object.assign(plugin, { hasMessageContent: messageContent });
  }
 });

 const body = buildCommandBody.call(client, onlyPlugin);

 const delNames = process.argv
  .find((arg) => arg.startsWith('--del='))
  ?.slice('--del='.length)
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

 const tokenEnv = process.argv
  .find((arg) => arg.startsWith('--token='))
  ?.slice('--token='.length)
  .trim();
 const token = tokenEnv ? (process.env[tokenEnv] ?? '').trim() : '';

 if (tokenEnv && !token) {
  logger.error(`${tag} Env var ${tokenEnv} is empty or missing`);
  process.exit(1);
 }

 if (Boolean(tokenEnv) !== Boolean(pluginName)) {
  logger.error(`${tag} --token and --plugin must be used together, or both omitted (main bot)`);
  process.exit(1);
 }

 const api = tokenEnv ? client.getTokenAPI(token) : client.getBaseAPI();

 return { client, api, body, delNames };
}
