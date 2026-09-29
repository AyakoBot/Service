import type { GatewayDispatchEvents } from '@discordjs/core';
import {
 ApplicationCommandType,
 InteractionType,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { ConfessionsRoute, bansCommandName, commandName } from '../../Classes/Routes.js';
import type ConfessionsPlugin from '../../Plugin.js';

import { bansPage, bansUnban, openBans } from './bans.js';
import { deleteSubmit, menuAction, openBanForm, openMenu, reportSubmit } from './menu.js';
import { approve, banSubmit, deny, denyModal, reveal, unban } from './review.js';
import { openModal, openReplyModal, submit, submitReply } from './submit.js';

type ComponentHandler = (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
) => Promise<void>;

type ModalHandler = (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 confessionId: string,
) => Promise<void>;

type CommandHandler = (
 this: ConfessionsPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
) => Promise<void>;

const components: Partial<Record<ConfessionsRoute, ComponentHandler>> = {
 [ConfessionsRoute.Approve]: approve,
 [ConfessionsRoute.Deny]: denyModal,
 [ConfessionsRoute.Ban]: openBanForm,
 [ConfessionsRoute.Unban]: unban,
 [ConfessionsRoute.Reveal]: reveal,
 [ConfessionsRoute.Menu]: openMenu,
 [ConfessionsRoute.MenuAction]: menuAction,
 [ConfessionsRoute.Reply]: openReplyModal,
};

const modals: Partial<Record<ConfessionsRoute, ModalHandler>> = {
 [ConfessionsRoute.DenyModal]: deny,
 [ConfessionsRoute.BanModal]: banSubmit,
 [ConfessionsRoute.ReportModal]: reportSubmit,
 [ConfessionsRoute.DeleteModal]: deleteSubmit,
 [ConfessionsRoute.ReplyModal]: submitReply,
};

const commands: Record<string, CommandHandler> = {
 [commandName]: openModal,
 [bansCommandName]: openBans,
};

const splitRoute = (customId: string): { route: string; args: string[] } => {
 const [route, ...args] = customId.split('_');
 return { route: route ?? '', args };
};

const onCommand = function (
 this: ConfessionsPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): void {
 const handler = commands[cmd.data.name];
 if (handler) void handler.call(this, cmd);
};

const onComponent = function (this: ConfessionsPlugin, cmd: APIMessageComponentInteraction): void {
 const { route, args } = splitRoute(cmd.data.custom_id);
 if (!cmd.guild_id) return;

 if (route === ConfessionsRoute.Submit) {
  void openModal.call(this, cmd);
  return;
 }

 if (route === ConfessionsRoute.BansPage) {
  void bansPage.call(this, cmd, args[0] ?? '0');
  return;
 }

 if (route === ConfessionsRoute.BansUnban && args[0]) {
  void bansUnban.call(this, cmd, args[0], args[1] ?? '0');
  return;
 }

 const handler = components[route as ConfessionsRoute];
 if (handler && args[0]) void handler.call(this, cmd, args[0]);
};

const onModal = function (this: ConfessionsPlugin, cmd: APIModalSubmitInteraction): void {
 const { route, args } = splitRoute(cmd.data.custom_id);
 if (!cmd.guild_id) return;

 if (route === ConfessionsRoute.SubmitModal) {
  void submit.call(this, cmd);
  return;
 }

 const handler = modals[route as ConfessionsRoute];
 if (handler && args[0]) void handler.call(this, cmd, args[0]);
};

export default function (
 this: ConfessionsPlugin,
 data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
): void {
 switch (data.type) {
  case InteractionType.ApplicationCommand: {
   if (data.data.type !== ApplicationCommandType.ChatInput) return;

   onCommand.call(this, data as APIChatInputApplicationCommandInteraction);
   return;
  }
  case InteractionType.MessageComponent:
   onComponent.call(this, data as APIMessageComponentInteraction);
   return;
  case InteractionType.ModalSubmit:
   onModal.call(this, data as APIModalSubmitInteraction);
   return;
  default:
   return;
 }
}
