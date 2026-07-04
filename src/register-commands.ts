import { RequestHandlerError } from '@ayako/api';
import { logger } from '@ayako/utility';
import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });

// eslint-disable-next-line @typescript-eslint/naming-convention
const { default: Client } = await import('./Classes/Client.js');
const { default: pluginAFK } = await import('./Plugins/afk/Plugin.js');
const { default: pluginFilterScraper } = await import('./Plugins/filterScraper/Plugin.js');
const { default: pluginSettings } = await import('./Plugins/settings/Plugin.js');
const { default: pluginCustomClients } = await import('./Plugins/customClients/Plugin.js');
const { default: pluginTicketing } = await import('./Plugins/ticketing/Plugin.js');
const { default: pluginEval } = await import('./Plugins/eval/Plugin.js');
const { default: pluginEmbedBuilder } = await import('./Plugins/embedBuilder/Plugin.js');
const { default: pluginComponentBuilder } = await import('./Plugins/componentBuilder/Plugin.js');
const { default: buildCommandBody } = await import('./Util/buildCommandBody.js');

const client = new Client();
client.registerPlugin(pluginAFK);
client.registerPlugin(pluginFilterScraper);
client.registerPlugin(pluginSettings);
client.registerPlugin(pluginCustomClients);
client.registerPlugin(pluginTicketing);
client.registerPlugin(pluginEval);
client.registerPlugin(pluginEmbedBuilder);
client.registerPlugin(pluginComponentBuilder);

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
 logger.error(`[register] Plugin "${pluginName}" not found`);
 process.exit(1);
}

const body = buildCommandBody(client, onlyPlugin);

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
 logger.error(`[register] Env var ${tokenEnv} is empty or missing`);
 process.exit(1);
}

if (Boolean(tokenEnv) !== Boolean(pluginName)) {
 logger.error(
  '[register] --token and --plugin must be used together, or both omitted (main bot)',
 );
 process.exit(1);
}

const api = tokenEnv ? client.getTokenAPI(token) : client.getBaseAPI();

if (delNames?.length) {
 const existing = await api.applicationCommands.getGlobalCommands(undefined, {
  origin: 'register-commands',
  reason: 'Listing global commands to delete',
 });

 if (!(existing instanceof RequestHandlerError)) {
  for (const command of existing) {
   if (!delNames.includes(command.name)) continue;

   await api.applicationCommands.deleteGlobalCommand(command.id, {
    origin: 'register-commands',
    reason: 'Deleting global command',
   });
   logger.log(`[register] Deleted global command ${command.name}`);
  }
 }
}

for (const command of body) {
 await api.applicationCommands.createGlobalCommand(command, {
  origin: 'register-commands',
  reason: 'Publishing global commands',
 });
}

logger.log(`[register] Pushed ${body.length} global commands`);
process.exit(0);
