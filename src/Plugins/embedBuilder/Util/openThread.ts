import { RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import { ChannelType, type APIEmbed, type APIInteraction } from 'discord-api-types/v10';

import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import type EmbedBuilderPlugin from '../Plugin.js';

import { renderBuilder } from './renderBuilder.js';

const archiveMinutes = 1440;

export const openThread = async function (
 this: EmbedBuilderPlugin,
 cmd: APIInteraction,
 embed: APIEmbed,
): Promise<string | RequestHandlerError<RequestHandlerErrorType> | null> {
 if (!cmd.guild_id || !cmd.channel || !cmd.member) return null;

 const api = await this.getAPI(cmd.guild_id);
 const userId = cmd.member.user.id;

 const thread = await api.channels.createThread(
  cmd.channel.id,
  {
   name: cmd.member.user.username.slice(0, 100),
   type: ChannelType.PrivateThread,
   auto_archive_duration: archiveMinutes,
  },
  undefined,
  { origin: this.name, reason: 'Creating embed builder thread' },
 );
 if (!thread || thread instanceof RequestHandlerError) return null;

 const added = await api.threads.addMember(thread.id, userId, {
  origin: this.name,
  reason: 'Adding builder owner to thread',
 });
 if (added instanceof RequestHandlerError) {
  this.nonFatalError(added, 'openThread.addMember');
  return added;
 }

 const t = await this.t(cmd.guild_id);
 const payload = renderBuilder.call(this, t, {
  marker: { execId: userId },
  embed,
  selectedField: null,
  selectedProperty: null,
  canManage: hasManageGuild(cmd.member.permissions),
 });

 const sent = await api.channels.createMessage(thread.id, payload.getAPIPayload(), {
  origin: this.name,
  reason: 'Posting embed builder surface',
 });
 if (sent instanceof RequestHandlerError) {
  this.nonFatalError(sent, 'openThread.post');
  return null;
 }

 return thread.id;
};
