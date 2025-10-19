import { getInfo } from 'discord-hybrid-sharding';
import client from '../../../BaseClient/Client.js';
import util from '../../../BaseClient/Bot/Util.js';

import startupTasks from './startupTasks.js';

let ready = !process.argv.includes('--debug');

export default async () => {
 client.util = util;

 if (ready) return;
 ready = true;

 // eslint-disable-next-line no-console
 console.log(
  `| => Bot: ${client.user?.username}#${client.user?.discriminator} / ${client.user?.id}
| => Cluster: ${Number(client.cluster?.id) + 1}
| => Shards: ${getInfo()
   .SHARD_LIST.map((s) => s + 1)
   .join(', ')}
| Login at ${new Date(Date.now()).toLocaleString()}`,
 );

 startupTasks();
};

export const getReady = () => ready;
export const setReady = () => {
 ready = false;
};
