import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 InteractionType,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { settingsCommandName } from '../../../../Util/buildCommandBody.js';
import { WelcomeCommand, WelcomeSubcommand } from '../../Classes/Commands.js';
import { GreetingKind } from '../../Classes/Enums.js';
import { WelcomeRoute } from '../../Classes/Routes.js';
import type WelcomePlugin from '../../Plugin.js';

import { gifDelete, gifList, gifPage } from './gifList.js';
import saveGif from './saveGif.js';
import testGreeting from './testGreeting.js';

const contextMenuKinds: Record<WelcomeCommand, GreetingKind> = {
 [WelcomeCommand.SaveGifWelcome]: GreetingKind.Welcome,
 [WelcomeCommand.SaveGifGoodbye]: GreetingKind.Goodbye,
};

const subcommandKinds: Record<WelcomeSubcommand, GreetingKind> = {
 [WelcomeSubcommand.WelcomeGifs]: GreetingKind.Welcome,
 [WelcomeSubcommand.GoodbyeGifs]: GreetingKind.Goodbye,
};

const extractSubcommand = (cmd: APIApplicationCommandInteraction) => {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return undefined;

 const top = cmd.data.options?.[0];
 if (!top) return undefined;
 if (top.type === ApplicationCommandOptionType.SubcommandGroup) return top.options?.[0]?.name;
 if (top.type === ApplicationCommandOptionType.Subcommand) return top.name;
 return undefined;
};

const handleCommand = async function (
 this: WelcomePlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (cmd.data.type === ApplicationCommandType.Message) {
  const kind = contextMenuKinds[cmd.data.name as WelcomeCommand];
  if (kind) await saveGif.call(this, cmd, kind);
  return;
 }

 if (cmd.data.name !== settingsCommandName) return;

 const kind = subcommandKinds[extractSubcommand(cmd) as WelcomeSubcommand];
 if (kind) await gifList.call(this, cmd, kind);
};

export default async function (
 this: WelcomePlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 const run = (promise: Promise<unknown>, context: string) =>
  promise.catch((error: Error) => this.nonFatalError(error, context));

 if (cmd.type === InteractionType.ApplicationCommand) {
  await run(handleCommand.call(this, cmd as APIApplicationCommandInteraction), 'welcome command');
  return;
 }

 if (cmd.type !== InteractionType.MessageComponent) return;

 const interaction = cmd as APIMessageComponentInteraction;
 const [route, ...args] = interaction.data.custom_id.split('_');

 switch (route as WelcomeRoute) {
  case WelcomeRoute.TestWelcome:
   await run(testGreeting.call(this, interaction, GreetingKind.Welcome), route);
   break;
  case WelcomeRoute.TestGoodbye:
   await run(testGreeting.call(this, interaction, GreetingKind.Goodbye), route);
   break;
  case WelcomeRoute.GifsWelcome:
   await run(gifList.call(this, interaction, GreetingKind.Welcome), route);
   break;
  case WelcomeRoute.GifsGoodbye:
   await run(gifList.call(this, interaction, GreetingKind.Goodbye), route);
   break;
  case WelcomeRoute.GifPage:
   await run(gifPage.call(this, interaction, args), route);
   break;
  case WelcomeRoute.GifDelete:
   await run(gifDelete.call(this, interaction, args), route);
   break;
  default:
   break;
 }
}
