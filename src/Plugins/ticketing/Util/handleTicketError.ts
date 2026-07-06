import type {
 APIMessageComponentInteraction,
 APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { BaseTicketErrors } from '../Classes/Enums.js';
import TicketPlugin from '../Plugin.js';

import showCommandError from './showCommandError.js';

export default async function (
 this: Client,
 {
  guildId,
  error,
  cmd,
 }: {
  guildId: string;
  error: Error;
  cmd: APIMessageComponentInteraction | APIModalSubmitInteraction;
 },
) {
 const plugin = this.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;
 const t = await plugin.t(guildId);

 const errorMessage = getErrorMessage.call(this, t, error);
 showCommandError.call(this, errorMessage, cmd, t.base);

 return true;
}

const getErrorMessage = function (
 this: Client,
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 error: Error,
) {
 const plugin = this.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;

 switch (error.message) {
  case BaseTicketErrors.userNotFound:
   return t.base.errors.userNotFound();

  case BaseTicketErrors.create_LimitKindReached:
   return t.errors[BaseTicketErrors.create_LimitKindReached]({
    count: String((error.cause as { count?: number } | undefined)?.count ?? 0),
   });

  case BaseTicketErrors.create_LimitTotalReached:
   return t.errors[BaseTicketErrors.create_LimitTotalReached]({
    count: String((error.cause as { count?: number } | undefined)?.count ?? 0),
   });

  default: {
   if (Object.keys(t.errors).includes(error.message)) {
    return t.errors[error.message as keyof typeof t.errors]();
   }

   plugin.nonFatalError(error, 'ticketErrorHandler');
   return `${t.base.errors.unknownError()} - ${error.message}`;
  }
 }
};
