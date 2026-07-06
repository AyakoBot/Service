import { RequestHandlerError } from '@ayako/api';
import { logger } from '@ayako/utility';

import registerCommandsSetup from './Util/registerCommandsSetup.js';

const { client, api, body, delNames } = await registerCommandsSetup('[register-dev]');

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
 } else {
  for (const command of body) {
   await api.applicationCommands.createGuildCommand(guildId, command, {
    origin: 'register-commands-dev',
    reason: 'Publishing dev guild commands',
   });
  }

  logger.log(`[register-dev] Pushed ${body.length} commands to ${guildId}`);
 }
}

process.exit(0);
