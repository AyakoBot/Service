import { ActionRowBuilder, ButtonBuilder, ContainerBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type SettingsPlugin from '../../Plugin.js';
import type { TopLevelBuilder } from '../../Util/buildGroupPage.js';
import { encodeSettingsId, SettingsAction, type SettingsId } from '../../Util/customId.js';
import { globalSchemaTranslator } from '../../Util/globalSchemaTranslator.js';
import { renderInlineField } from '../../Util/renderInlineField.js';
import { InlineKind, resolveInlineKind } from '../../Util/resolveInlineKind.js';
import { buttonEmoji } from '../../Util/settingsEmotes.js';

import fieldModal from './fieldModal.js';

export default async function (
 this: SettingsPlugin,
 cmd: APIMessageComponentInteraction,
 id: SettingsId,
) {
 if (!cmd.guild_id || !id.rowId || !id.column || id.guideFlags === undefined) return;

 const resolved = this.resolveSchema(id.settingName);
 if (!resolved) return;

 const schema = globalSchemaTranslator(await resolved.plugin.t(cmd.guild_id), resolved.schema);
 const field = schema.groups.flatMap((g) => g.fields).find((f) => f.column === id.column);
 if (!field) return;

 const row = await this.tableClient(resolved.schema.table).findFirst({
  where: { id: id.rowId, guild: cmd.guild_id },
 });
 if (!row) return;

 const visible = field.showIf ? field.showIf(row) : { ok: true };

 if (visible.ok && resolveInlineKind(field) === InlineKind.ModalText) {
  await fieldModal.call(this, cmd, id);
  return;
 }

 const t = await this.t(cmd.guild_id);
 const api = await resolved.plugin.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const idFor = (action: SettingsAction, column: string): string =>
  encodeSettingsId({
   action,
   settingName: id.settingName,
   rowId: id.rowId,
   groupId: id.groupId,
   column,
   hideUnavail: true,
   guideFlags: id.guideFlags,
   guideSection: id.guideSection,
  });

 const container = new ContainerBuilder();
 renderInlineField(
  container,
  emotes,
  field,
  row,
  idFor,
  {
   enabled: t.navigator.enabled(),
   disabled: t.navigator.disabled(),
   change: t.navigator.change(),
  },
  visible,
 );

 const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setLabel(t.guide.back())
   .setEmoji(buttonEmoji(emotes.back))
   .setCustomId(
    encodeSettingsId({
     action: SettingsAction.Guide,
     settingName: id.settingName,
     rowId: id.rowId,
     groupId: id.groupId,
     hideUnavail: true,
     guideFlags: id.guideFlags,
     guideSection: id.guideSection,
    }),
   ),
 );

 const page: TopLevelBuilder[] = [container, back];

 new MessagePayload(this.client, { origin: this.name, reason: 'Settings guide step' })
  .setComponents(page.map((c) => c.toJSON() as APIMessageTopLevelComponent))
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .update(cmd);
}
