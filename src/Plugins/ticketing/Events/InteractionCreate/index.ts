import {
 ApplicationCommandType,
 ComponentType,
 InteractionType,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';

import create from './create.js';
import setup from './setup.js';

export default async function (
 this: TicketPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   command.call(this, cmd);
   break;
  case InteractionType.MessageComponent:
   if (cmd.data.component_type !== ComponentType.Button) return;
   button.call(this, cmd);
   break;
 }
}

const command = async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 switch (cmd.data.name) {
  case 'ticket/setup': {
   setup.call(this, cmd);
   break;
  }
 }
};

const button = async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case 'ticket/create': {
   create.call(this, cmd, args);
   break;
  }
 }
};
