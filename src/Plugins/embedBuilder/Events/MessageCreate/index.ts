import { getGuildPerms } from '@ayako/utility';
import { PermissionFlagsBits } from '@discordjs/core';
import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import fetchMessages from '../../../../Util/fetchMessages.js';
import { propertyInputs, PropertyInput } from '../../Classes/Properties.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { applyProperty } from '../../Util/applyProperty.js';
import {
 getSelectedField,
 getSelectedProperty,
 getWipEmbed,
 parseMarker,
 type BuilderMessageLike,
} from '../../Util/builderState.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

export default async function (
 this: EmbedBuilderPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (msg.author.bot) return;
 if (!msg.guild_id || !msg.content) return;
 if (msg.type !== MessageType.Default && msg.type !== MessageType.Reply) return;

 const thread = await this.client.cache.threads.get(msg.channel_id);
 if (!thread) return;

 const api = await this.getAPI(msg.guild_id);
 if (thread.owner_id !== api.botId) return;

 const messages = await fetchMessages.call(
  this.client,
  msg.channel_id,
  msg.guild_id,
  { amount: 100, abortWhen: (m) => Boolean(parseMarker(m as BuilderMessageLike)) },
  { origin: this.name, reason: 'Locating embed builder surface' },
 );

 const builderMsg = messages.find((m) => parseMarker(m as BuilderMessageLike));
 if (!builderMsg) return;

 const surface = builderMsg as BuilderMessageLike & { id: string };
 const marker = parseMarker(surface);
 if (!marker || marker.execId !== msg.author.id) return;

 const property = getSelectedProperty(surface);
 if (!property || propertyInputs[property] !== PropertyInput.Typed) return;

 const result = applyProperty(
  getWipEmbed(surface),
  property,
  msg.content,
  getSelectedField(surface),
 );
 if (!result.ok) return;

 api.channels.deleteMessage(msg.channel_id, msg.id, {
  origin: this.name,
  reason: 'Consuming typed embed builder value',
 });

 const permissions = await getGuildPerms.call(this.client.cache, msg.guild_id, msg.author.id);
 const canManage =
  (permissions.response & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild ||
  (permissions.response & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;

 const t = await this.t(msg.guild_id);
 await renderBuilder
  .call(this, t, {
   marker,
   embed: result.embed,
   selectedField: getSelectedField(surface),
   selectedProperty: null,
   canManage,
  })
  .edit(msg.channel_id, surface.id, msg.guild_id);
}
