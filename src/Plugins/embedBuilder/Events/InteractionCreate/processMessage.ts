import {
 ApplicationCommandType,
 type APIApplicationCommandInteraction,
 type APIMessageApplicationCommandInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { processBuilderMessage } from '../MessageCreate/index.js';

export default async function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (!cmd.guild_id) return;
 if (cmd.data.type !== ApplicationCommandType.Message) return;

 const { data } = cmd as APIMessageApplicationCommandInteraction;
 const message = data.resolved.messages[data.target_id];
 const t = await this.t(cmd.guild_id);

 if (!message?.content) {
  ephemeralNote.call(this, cmd, t.processMessage.empty());
  return;
 }

 const author = cmd.member?.user ?? cmd.user;
 if (!author || message.author.id !== author.id) {
  ephemeralNote.call(this, cmd, t.processMessage.notYours());
  return;
 }

 await processBuilderMessage.call(this, {
  ...message,
  guild_id: cmd.guild_id,
  channel_id: message.channel_id ?? cmd.channel?.id,
 } as ExtractPayload<GatewayDispatchEvents.MessageCreate>);

 ephemeralNote.call(this, cmd, t.processMessage.applied());
}
