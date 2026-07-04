import { RequestHandlerError } from '@ayako/api';
import { txtFileWriter } from '@ayako/utility';
import {
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { getStringOption, getSubcommand } from '../../../../Util/interactionOptions.js';
import { messageLinkPattern } from '../../../../Util/messageLink.js';
import { ComponentBuilderSubcommand } from '../../Classes/Commands.js';
import CustomComponents from '../../CustomComponents.js';
import type ComponentBuilderPlugin from '../../Plugin.js';

import { startOpen } from './start.js';

const fileReply = function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 json: string,
 name: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Components JSON view' })
  .setFiles([txtFileWriter(json, name)])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const errorReply = function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Components JSON view error' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const viewMessage = async function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const match = getStringOption(sub, 'message-link').match(messageLinkPattern);
 if (!match || match[1] !== cmd.guild_id) {
  errorReply.call(this, cmd, t.errors.notALink());
  return;
 }

 const api = await this.getAPI(cmd.guild_id);
 const message = await api.channels.getMessage(match[2], match[3], {
  origin: this.name,
  reason: 'Fetching message for components JSON view',
 });
 if (message instanceof RequestHandlerError || !message.components?.length) {
  errorReply.call(this, cmd, t.base.errors.messageNotFound());
  return;
 }

 fileReply.call(this, cmd, JSON.stringify(message.components, null, 2), 'components');
};

const viewSaved = async function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const row = await CustomComponents.byName(this.client, cmd.guild_id, getStringOption(sub, 'name'));
 if (!row) {
  errorReply.call(this, cmd, t.errors.notFound());
  return;
 }

 fileReply.call(this, cmd, JSON.stringify(row.components ?? [], null, 2), row.name || 'components');
};

export default async function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 const sub = getSubcommand(cmd);
 if (!sub) return;

 switch (sub.name) {
  case ComponentBuilderSubcommand.Create:
   startOpen.call(this, cmd);
   break;
  case ComponentBuilderSubcommand.ViewMessage:
   viewMessage.call(this, cmd, sub);
   break;
  case ComponentBuilderSubcommand.ViewSaved:
   viewSaved.call(this, cmd, sub);
   break;
  default:
   break;
 }
}
