import { RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import { ChannelType, type APIInteraction } from 'discord-api-types/v10';

import { firstCycledStyle } from '../../../Util/buttonCycle.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import type { BuilderView } from './builderContext.js';
import type { WipTree } from './componentTree.js';
import { renderBuilder, renderDesign } from './renderBuilder.js';

const archiveMinutes = 1440;

export const openThread = async function (
 this: ComponentBuilderPlugin,
 cmd: APIInteraction,
 tree: WipTree,
): Promise<string | RequestHandlerError<RequestHandlerErrorType> | null> {
 if (!cmd.guild_id || !cmd.channel || !cmd.member) return null;

 const api = await this.getInteractionAPI(cmd);
 const userId = cmd.member.user.id;

 const thread = await api.channels.createThread(
  cmd.channel.id,
  {
   name: cmd.member.user.username.slice(0, 100),
   type: ChannelType.PrivateThread,
   auto_archive_duration: archiveMinutes,
  },
  undefined,
  { origin: this.name, reason: 'Creating component builder thread' },
 );
 if (!thread) return null;
 if (thread instanceof RequestHandlerError) return thread;

 const added = await api.threads.addMember(thread.id, userId, {
  origin: this.name,
  reason: 'Adding builder owner to thread',
 });
 if (added instanceof RequestHandlerError) {
  this.nonFatalError(added, 'openThread.addMember');
  return added;
 }

 const t = await this.t(cmd.guild_id);
 const view: BuilderView = {
  marker: { execId: userId },
  tree,
  selectedPath: null,
  nodePage: 0,
  canManage: hasManageGuild(cmd.member.permissions),
  placeholderStyle: firstCycledStyle,
  emotes: this.client.emojis.for(api),
 };

 const controls = await api.channels.createMessage(
  thread.id,
  renderBuilder.call(this, t, view).getAPIPayload(),
  { origin: this.name, reason: 'Posting component builder controls' },
 );
 if (controls instanceof RequestHandlerError) {
  this.nonFatalError(controls, 'openThread.post');
  return null;
 }

 const design = await api.channels.createMessage(
  thread.id,
  renderDesign.call(this, t, tree).getAPIPayload(),
  { origin: this.name, reason: 'Posting component builder design' },
 );
 if (design instanceof RequestHandlerError) {
  this.nonFatalError(design, 'openThread.design');
  return design;
 }

 const linked = await renderBuilder
  .call(this, t, { ...view, marker: { execId: userId, designId: design.id } })
  .edit(thread.id, controls.id, cmd.guild_id, api);
 if (linked instanceof RequestHandlerError) {
  this.nonFatalError(linked, 'openThread.link');
  return linked;
 }

 return thread.id;
};
