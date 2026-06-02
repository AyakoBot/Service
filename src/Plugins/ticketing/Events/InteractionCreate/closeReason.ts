import { type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassById from '../../Util/getTicketClassById.js';
import handleTicketError from '../../Util/handleTicketError.js';

const findModalValue = (components: unknown, customId: string): string | undefined => {
 if (!Array.isArray(components)) return undefined;

 for (const c of components) {
  if (!c || typeof c !== 'object') continue;
  const comp = c as Record<string, unknown>;

  if (comp.custom_id === customId && typeof comp.value === 'string') return comp.value;

  const nested =
   findModalValue(comp.components, customId) ??
   findModalValue(comp.component ? [comp.component] : undefined, customId);
  if (nested !== undefined) return nested;
 }

 return undefined;
};

export default async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild || !cmd.guild_id) return;

 const ticket = await getTicketClassById.call(this.client, args[0]).catch((e: Error) => e);
 const userId = cmd.user?.id || cmd.member?.user.id;

 if (!userId) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.userNotFound, { cause: userId }),
   cmd,
  });
  return;
 }

 if (ticket instanceof Error || ticket === null) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: ticket || new Error(BaseTicketErrors.ticketNotFound, { cause: args[0] }),
   cmd,
  });
  return;
 }

 const reason = findModalValue(cmd.data.components, 'reason');

 const close = ticket.close({ cmd, userId, reason });
 close.next().catch((e: Error) =>
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: e,
   cmd,
  }),
 );
}
