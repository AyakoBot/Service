/* eslint-disable no-console */
import 'dotenv/config';
import { config } from 'dotenv';
import 'longjohn';
import { scheduleJob } from 'node-schedule';
import { install } from 'source-map-support';

import Client from './Classes/Client.js';
import logger from './Classes/Logger.js';
import AFKPlugin from './Plugins/afk/Plugin.js';
import getPathFromError from './Util/getPathFromError.js';

config({
 path: '../../.env',
 quiet: true,
});

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
client.registerPlugin(AFKPlugin);

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
 logger.error('[Process] Unhandled rejection');
 console.log(reason);
});
