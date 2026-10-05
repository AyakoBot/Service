import { ApplicationCommandType, InteractionType, type GatewayDispatchEvents } from '@discordjs/core';
import type {
 APIChatInputApplicationCommandInteraction,
 APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { modCommandName } from '../../../../Util/buildCommandBody.js';
import Afk from '../../Classes/Afk.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';

import buttons from './buttons.js';
import mod from './mod.js';

export default async function (
 this: AFKPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (cmd.type === InteractionType.MessageComponent) {
  await buttons.call(this, cmd as APIMessageComponentInteraction);
  return;
 }

 if (cmd.type !== InteractionType.ApplicationCommand) return;
 if (!cmd.guild_id || !cmd.channel?.id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user?.id) return;
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 const chatInput = cmd as APIChatInputApplicationCommandInteraction;

 switch (cmd.data.name) {
  case AfkCommand.Afk:
   await new Afk(this, user.id, cmd.guild_id).set(chatInput);
   break;
  case modCommandName:
   await mod.call(this, chatInput);
   break;
  default:
   break;
 }
}
