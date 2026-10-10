import { RequestHandlerError } from '@ayako/api';
import {
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type ComponentBuilderPlugin from '../Plugin.js';

import type { BuilderView } from './builderContext.js';
import type { WipTree } from './componentTree.js';
import { renderBuilder, renderDesign } from './renderBuilder.js';

export const presentBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 before: WipTree,
 view: BuilderView,
 rows?: APIMessageTopLevelComponent[],
): Promise<void> {
 const t = await this.t(cmd.guild_id ?? undefined);
 await renderBuilder.call(this, t, view, rows).update(cmd);

 const channelId = cmd.message?.channel_id;
 if (!cmd.guild_id || !channelId || !view.marker.designId) return;
 if (JSON.stringify(before) === JSON.stringify(view.tree)) return;

 const api = await this.getInteractionAPI(cmd);
 const edited = await renderDesign
  .call(this, t, view.tree)
  .edit(channelId, view.marker.designId, cmd.guild_id, api);
 if (!(edited instanceof RequestHandlerError)) return;

 await api.webhooks.execute(
  cmd.application_id,
  cmd.token,
  {
   content: t.errors.designEditFailed({ error: edited.errorMessage ?? '' }),
   flags: MessageFlags.Ephemeral,
  },
  { origin: this.name, reason: 'Component builder design edit failed' },
 );
};
