import { RequestHandlerError } from '@ayako/api';
import { logger } from '@ayako/utility';

import registerCommandsSetup from './Util/registerCommandsSetup.js';

const { api, body, delNames } = await registerCommandsSetup('[register]');

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
