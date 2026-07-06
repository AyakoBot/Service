import {
 MessageFlags,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { hasManageGuild } from '../../settings/Util/authorizeSettings.js';
import type EmbedBuilderPlugin from '../Plugin.js';

import {
 getSelectedField,
 getSelectedProperty,
 getWipEmbed,
 parseMarker,
} from './builderState.js';
import type { BuilderView } from './renderBuilder.js';

export const ephemeralNote = function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Embed builder warning' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

export const builderContext = async function (
 this: EmbedBuilderPlugin,
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

 return {
  message,
  view: {
   marker,
   embed: getWipEmbed(message),
   selectedField: getSelectedField(message),
   selectedProperty: getSelectedProperty(message),
   canManage: hasManageGuild(cmd.member?.permissions),
  },
 };
};

export const authorizeManage = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
): Promise<boolean> {
 if (hasManageGuild(cmd.member?.permissions)) return true;

 const t = await this.t(cmd.guild_id ?? undefined);
 ephemeralNote.call(this, cmd, t.errors.manageGuildRequired());
 return false;
};
