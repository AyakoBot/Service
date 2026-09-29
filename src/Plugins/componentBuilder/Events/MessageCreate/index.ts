import { RequestHandlerError } from '@ayako/api';
import { getGuildPerms } from '@ayako/utility';
import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { nextButtonStyle } from '../../../../Util/buttonCycle.js';
import fetchMessages from '../../../../Util/fetchMessages.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import { NodeKind } from '../../Classes/Nodes.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { applyText } from '../../Util/applyNode.js';
import {
 getNodePage,
 getSelectedPath,
 getWipTree,
 parseMarker,
 type BuilderMessageLike,
} from '../../Util/builderState.js';
import { getNode, kindOf } from '../../Util/componentTree.js';
import { renderBuilder, renderDesign } from '../../Util/renderBuilder.js';

export default async function (
 this: ComponentBuilderPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (msg.author.bot) return;
 if (!msg.guild_id || !msg.content) return;
 if (msg.type !== MessageType.Default && msg.type !== MessageType.Reply) return;

 const thread = await this.client.cache.threads.get(msg.channel_id);
 if (!thread) return;

 const api =
  (thread.owner_id ? this.client.getAppAPI(thread.owner_id, msg.guild_id) : null) ??
  (await this.getAPI(msg.guild_id));
 if (thread.owner_id !== api.botId) return;

 const messages = await fetchMessages.call(
  this.client,
  msg.channel_id,
  msg.guild_id,
  { amount: 100, abortWhen: (m) => Boolean(parseMarker(m as BuilderMessageLike)) },
  { origin: this.name, reason: 'Locating component builder surface' },
  api,
 );

 const builderMsg = messages.find((m) => parseMarker(m as BuilderMessageLike));
 if (!builderMsg) return;

 const surface = builderMsg as BuilderMessageLike & { id: string };
 const marker = parseMarker(surface);
 if (!marker?.designId || marker.execId !== msg.author.id) return;

 const design =
  (messages.find((m) => (m as { id?: string }).id === marker.designId) as
   | BuilderMessageLike
   | undefined) ??
  (await api.channels.getMessage(msg.channel_id, marker.designId, {
   origin: this.name,
   reason: 'Reading the component builder design',
  }));
 if (design instanceof RequestHandlerError) return;

 const tree = getWipTree(design);
 const selectedPath = getSelectedPath(surface);
 if (!selectedPath) return;

 const node = getNode(tree, selectedPath);
 if (!node || kindOf(node) !== NodeKind.Text) return;

 const result = applyText(tree, selectedPath, msg.content);
 if (!result.ok) return;

 api.channels.deleteMessage(msg.channel_id, msg.id, {
  origin: this.name,
  reason: 'Consuming typed component builder value',
 });

 const permissions = await getGuildPerms.call(this.client.cache, msg.guild_id, msg.author.id);
 const canManage = hasManageGuild(permissions.response);

 const t = await this.t(msg.guild_id);
 await renderBuilder
  .call(this, t, {
   marker,
   tree: result.tree,
   selectedPath: null,
   nodePage: getNodePage(surface),
   canManage,
   placeholderStyle: nextButtonStyle(
    surface.components,
    this.getRoute(ComponentBuilderRoute.Placeholders),
   ),
   emotes: this.client.emojis.for(api),
  })
  .edit(msg.channel_id, surface.id, msg.guild_id, api);
 await renderDesign
  .call(this, t, result.tree)
  .edit(msg.channel_id, marker.designId, msg.guild_id, api);
}
