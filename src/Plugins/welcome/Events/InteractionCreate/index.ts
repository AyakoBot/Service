import {
 ComponentType,
 InteractionType,
 type APIMessageComponentInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { GreetingKind } from '../../Classes/Enums.js';
import { WelcomeRoute } from '../../Classes/Routes.js';
import type WelcomePlugin from '../../Plugin.js';

import testGreeting from './testGreeting.js';

export default async function (
 this: WelcomePlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (cmd.type !== InteractionType.MessageComponent) return;

 const interaction = cmd as APIMessageComponentInteraction;
 if (interaction.data.component_type !== ComponentType.Button) return;

 const [route] = interaction.data.custom_id.split('_');
 switch (route as WelcomeRoute) {
  case WelcomeRoute.TestWelcome:
   testGreeting.call(this, interaction, GreetingKind.Welcome);
   break;
  case WelcomeRoute.TestGoodbye:
   testGreeting.call(this, interaction, GreetingKind.Goodbye);
   break;
  default:
   break;
 }
}
