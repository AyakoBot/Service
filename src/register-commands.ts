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
const { default: buildCommandBody } = await import('./Util/buildCommandBody.js');

const client = new Client();
client.registerPlugin(pluginAFK);
client.registerPlugin(pluginFilterScraper);
client.registerPlugin(pluginSettings);
client.registerPlugin(pluginCustomClients);
client.registerPlugin(pluginTicketing);
client.registerPlugin(pluginEval);

const body = buildCommandBody(client);

const api = client.getBaseAPI();
await api.applicationCommands.bulkOverwriteGlobalCommands(body, {
 origin: 'register-commands',
 reason: 'Publishing global commands',
});

logger.log(`[register] Published ${body.length} global commands`);
process.exit(0);
