import { RequestHandlerError } from '@ayako/api';
import {
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { parseMarker, type BuilderMessageLike } from '../../Util/builderState.js';

type Design = APIMessageTopLevelComponent[];

const designIdPattern = /^\d+$/;
const previewLookback = 5;

const inBuilderPreview = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
): Promise<boolean> {
 if (!cmd.guild_id) return false;

 const api = await this.getAPI(cmd.guild_id);
 const earlier = await api.channels.getMessages(
  cmd.message.channel_id,
  { limit: previewLookback, before: cmd.message.id },
  { origin: this.name, reason: 'Checking for a component builder preview' },
 );
 if (earlier instanceof RequestHandlerError) return false;

 return earlier.some(
  (message) => parseMarker(message as BuilderMessageLike)?.designId === cmd.message.id,
 );
};

const savedDesign = async function (
 this: ComponentBuilderPlugin,
 guildId: string,
 id: string,
): Promise<Design | null> {
 if (!designIdPattern.test(id)) return null;

 const row = await this.client.db.client.customComponents.findFirst({
  where: { id, guild: guildId },
 });
 const tree = (row?.components ?? null) as unknown as Design | null;

 return tree?.length ? tree : null;
};

const designOrNote = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
): Promise<Design | null> {
 if (!cmd.guild_id) return null;

 const tree = await savedDesign.call(this, cmd.guild_id, args[0] ?? '');
 if (tree) return tree;

 const t = await this.t(cmd.guild_id);
 ephemeralNote.call(this, cmd, t.errors.designGone());
 return null;
};

export const showDesign = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const tree = await designOrNote.call(this, cmd, args);
 if (!tree || !cmd.guild_id) return;

 const api = await this.getAPI(cmd.guild_id);
 const sent = await api.interactions.reply(
  cmd.id,
  cmd.token,
  {
   components: tree,
   flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
   allowed_mentions: { parse: [] },
  },
  { origin: this.name, reason: 'Showing a saved design' },
 );

 if (sent instanceof RequestHandlerError) this.nonFatalError(sent, 'componentBuilder.showDesign');
};

export const switchDesign = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.guild_id && (await inBuilderPreview.call(this, cmd))) {
  const t = await this.t(cmd.guild_id);
  ephemeralNote.call(this, cmd, t.errors.previewSwitch());
  return;
 }

 const tree = await designOrNote.call(this, cmd, args);
 if (!tree || !cmd.guild_id) return;

 const api = await this.getAPI(cmd.guild_id);
 const updated = await api.interactions.updateMessage(
  cmd.id,
  cmd.token,
  { components: tree, flags: MessageFlags.IsComponentsV2, allowed_mentions: { parse: [] } },
  { origin: this.name, reason: 'Switching a panel to a saved design' },
 );

 if (updated instanceof RequestHandlerError) {
  this.nonFatalError(updated, 'componentBuilder.switchDesign');
 }
};
