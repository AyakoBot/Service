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
import { EmbedBuilderSubcommand } from '../../Classes/Commands.js';
import CustomEmbed from '../../CustomEmbed.js';
import type EmbedBuilderPlugin from '../../Plugin.js';

import { startOpen } from './start.js';

const fileReply = function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 json: string,
 name: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Embed JSON view' })
  .setFiles([txtFileWriter(json, name)])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const errorReply = function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Embed JSON view error' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const viewMessage = async function (
 this: EmbedBuilderPlugin,
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

 const api = await this.getInteractionAPI(cmd);
 const message = await api.channels.getMessage(match[2], match[3], {
  origin: this.name,
  reason: 'Fetching message for embed JSON view',
 });
 if (message instanceof RequestHandlerError || !message.embeds.length) {
  errorReply.call(this, cmd, t.base.errors.messageNotFound());
  return;
 }

 fileReply.call(this, cmd, JSON.stringify(message.embeds, null, 2), 'embeds');
};

const viewSaved = async function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const row = await CustomEmbed.byName(this.client, cmd.guild_id, getStringOption(sub, 'name'));
 if (!row) {
  errorReply.call(this, cmd, t.errors.notFound());
  return;
 }

 fileReply.call(this, cmd, JSON.stringify(row.embed ?? {}, null, 2), row.name || 'embed');
};

export default async function (this: EmbedBuilderPlugin, cmd: APIApplicationCommandInteraction) {
 const sub = getSubcommand(cmd);
 if (!sub) return;

 switch (sub.name) {
  case EmbedBuilderSubcommand.Create:
   startOpen.call(this, cmd);
   break;
  case EmbedBuilderSubcommand.ViewMessage:
   viewMessage.call(this, cmd, sub);
   break;
  case EmbedBuilderSubcommand.ViewSaved:
   viewSaved.call(this, cmd, sub);
   break;
  default:
   break;
 }
}
