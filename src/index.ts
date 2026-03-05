/* eslint-disable no-console */
import { getPathFromError, logger } from '@ayako/utility';
import { config } from 'dotenv';
import 'longjohn';
import { scheduleJob } from 'node-schedule';
import { install } from 'source-map-support';

config({
 path: '../../.env',
 quiet: true,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
const { default: Client } = await import('./Classes/Client.js');
const { default: pluginAFK } = await import('./Plugins/afk/Plugin.js');
const { default: pluginFilterScraper } = await import('./Plugins/filterScraper/Plugin.js');
const { default: pluginSettings } = await import('./Plugins/settings/Plugin.js');

console.log('+++++++++++++++++ Welcome to Ayako +++++++++++++++++');
console.log('+       Restart all Clusters with "restart"        +');
console.log('+                  Arguments:                      +');
console.log('+ --log-level=<silent|error|warn|info|debug|silly> +');
console.log('+            --silent --dev --register             +');
console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++');

logger.log('[Startup] Service starting');
logger.debug('[Startup] Process arguments:', process.argv.join(' '));
logger.silly('[Startup] Environment loaded via dotenv');

logger.debug('[Startup] Installing source-map-support');
install({
 handleUncaughtExceptions: process.argv.includes('--log-level=debug'),
 environment: 'node',
 emptyCacheBetweenOperations: process.argv.includes('--log-level=debug'),
});
logger.silly(
 '[Startup] Source-map-support installed with uncaughtExceptions:',
 process.argv.includes('--log-level=debug'),
);

logger.debug('[Startup] Registering scheduled jobs');
scheduleJob(getPathFromError(new Error()), '*/10 * * * *', async () => {
 logger.log(`=> Current Date: ${new Date().toLocaleString()}`);
});
logger.silly('[Startup] Scheduled job registered: heartbeat every 10 minutes');

logger.log('[Startup] Creating Client instance');
const client = new Client();

logger.log('[Startup] Registering plugins');
client.registerPlugin(pluginAFK);
client.registerPlugin(pluginFilterScraper);
client.registerPlugin(pluginSettings);

// TODO: remove
client.plugins.find((p) => p.name === 'Filter Scraper')?.disable();

process.on('SIGINT', () => {
 logger.log('[Shutdown] Received SIGINT signal');
 logger.debug('[Shutdown] Gracefully shutting down');
 process.exit(0);
});

process.on('SIGTERM', () => {
 logger.log('[Shutdown] Received SIGTERM signal');
 logger.debug('[Shutdown] Gracefully shutting down');
 process.exit(0);
});

process.on('uncaughtException', (error) => {
 logger.error('[Process] Uncaught exception:', error.message);
 logger.silly('[Process] Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
 logger.error('[Process] Unhandled rejection', JSON.stringify(reason));
});
