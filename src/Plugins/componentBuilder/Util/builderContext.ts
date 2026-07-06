import {
 MessageFlags,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import { getSelectedPath, getWipTree, parseMarker, type BuilderMarker } from './builderState.js';
import { getNode, type WipTree } from './componentTree.js';

export interface BuilderView {
 marker: BuilderMarker;
 tree: WipTree;
 selectedPath: string | null;
 canManage: boolean;
 emotes: EmoteSet;
}

export const ephemeralNote = function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Component builder warning' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

export const builderContext = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
): Promise<{ view: BuilderView; message: APIMessage } | null> {
 const { message } = cmd;
 if (!message || !cmd.guild_id) return null;

 const marker = parseMarker(message);
 if (!marker) return null;

 const userId = cmd.member?.user.id ?? cmd.user?.id;
 if (marker.execId !== userId) {
  const t = await this.t(cmd.guild_id);
  ephemeralNote.call(this, cmd, t.builder.notYourBuilder());
  return null;
 }

 const tree = getWipTree(message);
 const selectedPath = getSelectedPath(message);
 const api = await this.getAPI(cmd.guild_id);

 return {
  message,
  view: {
   marker,
   tree,
   selectedPath: selectedPath && getNode(tree, selectedPath) ? selectedPath : null,
   canManage: hasManageGuild(cmd.member?.permissions),
   emotes: this.client.emojis.for(api),
  },
 };
};

export const authorizeManage = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
): Promise<boolean> {
 if (hasManageGuild(cmd.member?.permissions)) return true;

 const t = await this.t(cmd.guild_id ?? undefined);
 ephemeralNote.call(this, cmd, t.errors.manageGuildRequired());
 return false;
};
