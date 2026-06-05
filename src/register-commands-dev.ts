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
const { default: buildCommandBody } = await import('./Util/buildCommandBody.js');

const client = new Client();
client.registerPlugin(pluginAFK);
client.registerPlugin(pluginFilterScraper);
client.registerPlugin(pluginSettings);
client.registerPlugin(pluginCustomClients);
client.registerPlugin(pluginTicketing);
client.registerPlugin(pluginEval);

const body = buildCommandBody(client);

const delNames = process.argv
 .find((arg) => arg.startsWith('--del='))
 ?.slice('--del='.length)
 .split(',')
 .map((name) => name.trim())
 .filter((name) => name.length > 0);

const api = client.getBaseAPI();
for (const guildId of client.debugGuilds) {
 if (delNames?.length) {
  const existing = await api.applicationCommands.getGuildCommands(guildId, undefined, {
   origin: 'register-commands-dev',
   reason: 'Listing guild commands to delete',
  });

  if (!(existing instanceof RequestHandlerError)) {
   for (const command of existing) {
    if (!delNames.includes(command.name)) continue;

    await api.applicationCommands.deleteGuildCommand(guildId, command.id, {
     origin: 'register-commands-dev',
     reason: 'Deleting guild command',
    });
    logger.log(`[register-dev] Deleted ${command.name} from ${guildId}`);
   }
  }
 }

 for (const command of body) {
  await api.applicationCommands.createGuildCommand(guildId, command, {
   origin: 'register-commands-dev',
   reason: 'Publishing dev guild commands',
  });
 }

 logger.log(`[register-dev] Pushed ${body.length} commands to ${guildId}`);
}

process.exit(0);
