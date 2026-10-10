import { RequestHandlerError } from '@ayako/api';
import {
 type APIMessage,
 type ButtonStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { nextButtonStyle } from '../../../Util/buttonCycle.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import { ComponentBuilderCommand, ComponentBuilderSubcommand } from '../Classes/Commands.js';
import { ComponentBuilderRoute } from '../Classes/Routes.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import {
 getNodePage,
 getSelectedPath,
 getWipTree,
 parseMarker,
 type BuilderMarker,
} from './builderState.js';
import { getNode, type WipTree } from './componentTree.js';

export interface BuilderView {
 marker: BuilderMarker;
 tree: WipTree;
 selectedPath: string | null;
 nodePage: number;
 canManage: boolean;
 placeholderStyle: ButtonStyle;
 emotes: EmoteSet;
}

export { ephemeralNote };

export const builderContext = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
): Promise<{ view: BuilderView; message: APIMessage } | null> {
 const { message } = cmd;
 if (!message || !cmd.guild_id) return null;

 const marker = parseMarker(message);
 if (!marker) return null;

 const t = await this.t(cmd.guild_id);
 const userId = cmd.member?.user.id ?? cmd.user?.id;
 if (marker.execId !== userId) {
  ephemeralNote.call(this, cmd, t.builder.notYourBuilder());
  return null;
 }

 const reopen = {
  command: `/${ComponentBuilderCommand.ComponentBuilder} ${ComponentBuilderSubcommand.Create}`,
 };
 if (!marker.designId) {
  ephemeralNote.call(this, cmd, t.errors.legacyBuilder(reopen));
  return null;
 }

 const api = await this.getInteractionAPI(cmd);
 const design = await api.channels.getMessage(message.channel_id, marker.designId, {
  origin: this.name,
  reason: 'Reading the component builder design',
 });
 if (design instanceof RequestHandlerError) {
  ephemeralNote.call(this, cmd, t.errors.designMissing(reopen));
  return null;
 }

 const tree = getWipTree(design);
 const selectedPath = getSelectedPath(message);

 return {
  message,
  view: {
   marker,
   tree,
   selectedPath: selectedPath && getNode(tree, selectedPath) ? selectedPath : null,
   nodePage: getNodePage(message),
   canManage: hasManageGuild(cmd.member?.permissions),
   placeholderStyle: nextButtonStyle(
    message.components,
    this.getRoute(ComponentBuilderRoute.Placeholders),
   ),
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
