import {
 ComponentType,
 InteractionType,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { getSubcommand } from '../../../../Util/interactionOptions.js';
import { InfoCommand, InfoSubcommand } from '../../Classes/Commands.js';
import { InfoRoute } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';

import automod from './automod.js';
import avatarBanner, { ImageKind } from './avatarBanner.js';
import badges from './badges.js';
import bot from './bot.js';
import channel from './channel.js';
import emoji, { emojiPage } from './emoji.js';
import events from './events.js';
import invite from './invite.js';
import membercount from './membercount.js';
import messageHistory, { messageHistoryPage } from './messageHistory.js';
import { featuresButton, membersButton, rolesButton } from './panelButtons.js';
import permissions, { basicPerms, permsSelect } from './permissions.js';
import ping from './ping.js';
import role from './role.js';
import server from './server.js';
import servers, { serversPage } from './servers.js';
import soundboard from './soundboard.js';
import sticker, { stickerPage } from './sticker.js';
import user, { rerenderUser } from './user.js';
import viewRaw from './viewRaw.js';
import webhook from './webhook.js';

type SubHandler = (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) => Promise<void>;

const subHandlers: Record<InfoSubcommand, SubHandler> = {
 [InfoSubcommand.User]: user,
 [InfoSubcommand.Avatar] (cmd, sub) {
  return avatarBanner.call(this, cmd, sub, ImageKind.Avatar);
 },
 [InfoSubcommand.Banner] (cmd, sub) {
  return avatarBanner.call(this, cmd, sub, ImageKind.Banner);
 },
 [InfoSubcommand.Server]: server,
 [InfoSubcommand.Channel]: channel,
 [InfoSubcommand.Role]: role,
 [InfoSubcommand.Emoji]: emoji,
 [InfoSubcommand.Sticker]: sticker,
 [InfoSubcommand.Invite]: invite,
 [InfoSubcommand.Bot]: bot,
 [InfoSubcommand.Badges]: badges,
 [InfoSubcommand.Servers]: servers,
 [InfoSubcommand.Events]: events,
 [InfoSubcommand.Webhook]: webhook,
 [InfoSubcommand.Automod]: automod,
 [InfoSubcommand.Soundboard]: soundboard,
 [InfoSubcommand.Permissions]: permissions,
};

export default async function (
 this: InfoPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand: {
   const interaction = cmd as APIApplicationCommandInteraction;

   switch (interaction.data.name) {
    case InfoCommand.Info: {
     const sub = getSubcommand(interaction);
     if (!sub) return;

     const handler = subHandlers[sub.name as InfoSubcommand];
     if (handler) handler.call(this, interaction, sub);
     break;
    }
    case InfoCommand.MemberCount:
     membercount.call(this, interaction);
     break;
    case InfoCommand.Ping:
     ping.call(this, interaction);
     break;
    case InfoCommand.ViewRaw:
     viewRaw.call(this, interaction);
     break;
    case InfoCommand.MessageHistory:
     messageHistory.call(this, interaction);
     break;
    default:
     break;
   }
   break;
  }
  case InteractionType.MessageComponent: {
   const interaction = cmd as APIMessageComponentInteraction;
   switch (interaction.data.component_type) {
    case ComponentType.Button:
     button.call(this, interaction);
     break;
    case ComponentType.ChannelSelect:
     channelSelect.call(this, interaction);
     break;
    default:
     break;
   }
   break;
  }
  default:
   break;
 }
}

const button = async function (this: InfoPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case InfoRoute.User: {
   rerenderUser.call(this, cmd, args);
   break;
  }
  case InfoRoute.Roles: {
   rolesButton.call(this, cmd, args);
   break;
  }
  case InfoRoute.BasicPerms: {
   basicPerms.call(this, cmd, args);
   break;
  }
  case InfoRoute.Features: {
   featuresButton.call(this, cmd, args);
   break;
  }
  case InfoRoute.Members: {
   membersButton.call(this, cmd, args);
   break;
  }
  case InfoRoute.EmojiPage: {
   emojiPage.call(this, cmd, args);
   break;
  }
  case InfoRoute.StickerPage: {
   stickerPage.call(this, cmd, args);
   break;
  }
  case InfoRoute.ServersPage: {
   serversPage.call(this, cmd, args);
   break;
  }
  case InfoRoute.MsgHistoryPage: {
   messageHistoryPage.call(this, cmd, args);
   break;
  }
  default:
   break;
 }
};

const channelSelect = async function (this: InfoPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case InfoRoute.Perms: {
   permsSelect.call(this, cmd, args);
   break;
  }
  default:
   break;
 }
};
