import { RequestHandlerError } from '@ayako/api';
import type { RESTPutAPIApplicationGuildCommandsJSONBody } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

export default async function (this: Client): Promise<void> {
 const everyCommand = this.plugins.flatMap((plugin) => plugin.getCommands().commands);

 await Promise.all(
  this.plugins.map(async (plugin) => {
   if (!plugin.getCustomBotTargets) return;

   const targets = await plugin.getCustomBotTargets().catch((error: Error) => {
    this.logger.error(`[CommandSync] ${plugin.name} target lookup failed: ${error.message}`);
    return [] as Array<{ token: string; guildId: string }>;
   });
   if (!targets.length) return;

   const source = plugin.customBotsAreGlobal ? everyCommand : plugin.getCommands().commands;
   const body = source.map((command) =>
    command.toJSON(),
   ) as RESTPutAPIApplicationGuildCommandsJSONBody;
   if (!body.length) return;

   const seen = new Set<string>();

   await Promise.all(
    targets.map(async (target) => {
     const key = `${target.token}:${target.guildId}`;
     if (seen.has(key)) return;
     seen.add(key);

     const api = this.getTokenAPI(target.token, target.guildId);
     const result = await api.applicationCommands.bulkOverwriteGuildCommands(
      target.guildId,
      body,
      {
       origin: 'syncCustomBotCommands',
       reason: `Syncing ${plugin.name} commands to a custom bot`,
      },
     );

     if (result instanceof RequestHandlerError) return;

     this.logger.log(
      `[CommandSync] ${body.length} commands -> app ${api.botId} in guild ${target.guildId}`,
     );
    }),
   );
  }),
 );
}
