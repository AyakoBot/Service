import { getGuildPerms } from '@ayako/utility';
import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import fetchMessages from '../../../../Util/fetchMessages.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import { NodeKind } from '../../Classes/Nodes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { applyText } from '../../Util/applyNode.js';
import {
 getSelectedPath,
 getWipTree,
 parseMarker,
 type BuilderMessageLike,
} from '../../Util/builderState.js';
import { getNode, kindOf } from '../../Util/componentTree.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

export default async function (
 this: ComponentBuilderPlugin,
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
  { origin: this.name, reason: 'Locating component builder surface' },
 );

 const builderMsg = messages.find((m) => parseMarker(m as BuilderMessageLike));
 if (!builderMsg) return;

 const surface = builderMsg as BuilderMessageLike & { id: string };
 const marker = parseMarker(surface);
 if (!marker || marker.execId !== msg.author.id) return;

 const tree = getWipTree(surface);
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
   canManage,
  })
  .edit(msg.channel_id, surface.id, msg.guild_id, api);
}
