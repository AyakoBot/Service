import { RequestHandlerError } from '@ayako/api';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import type { APIEmbed } from 'discord-api-types/v10';
import {
 ButtonStyle,
 MessageFlags,
 ComponentType,
 type APIApplicationCommandInteraction,
 type APIInteraction,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import { RespondMode } from '../../../../Util/respondMode.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import CustomEmbed from '../../CustomEmbed.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { authorizeManage, ephemeralNote } from '../../Util/builderContext.js';
import { openThread } from '../../Util/openThread.js';

const selectLimit = 25;

const buildStartSurface = async function (
 this: EmbedBuilderPlugin,
 cmd: APIInteraction,
 selectedId: string | null,
) {
 const guildId = cmd.guild_id as string;
 const t = await this.t(guildId);
 const api = await this.getInteractionAPI(cmd);
 const emotes = this.client.emojis.for(api);
 const saved = await CustomEmbed.all(this.client, guildId);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `# ${textEmote(emotes.json)} ${t.start.title()}\n-# ${t.start.desc()}`,
  ),
 );
 container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setCustomId(this.getRoute(EmbedBuilderRoute.Start))
    .setLabel(t.start.fresh())
    .setEmoji(buttonEmoji(emotes.plus)),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.getRoute(EmbedBuilderRoute.ImportJson))
    .setLabel(t.base.t.Import())
    .setEmoji(buttonEmoji(emotes.json)),
  ),
 );

 if (saved.length) {
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addActionRowComponents(
   new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
     .setCustomId(this.getRoute(EmbedBuilderRoute.LoadPick))
     .setPlaceholder(t.start.savedPlaceholder())
     .setMinValues(1)
     .setMaxValues(1)
     .addOptions(
      saved.slice(0, selectLimit).map((row) =>
       new StringSelectMenuOptionBuilder()
        .setLabel((row.name || t.settings.unnamed()).slice(0, 100))
        .setValue(String(row.id))
        .setEmoji(buttonEmoji(emotes.save))
        .setDefault(String(row.id) === selectedId),
      ),
     ),
   ),
  );
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.getRoute(EmbedBuilderRoute.LoadOpen, selectedId ?? ''))
     .setLabel(t.start.loadSelected())
     .setEmoji(buttonEmoji(emotes.edit))
     .setDisabled(!selectedId),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Danger)
     .setCustomId(this.getRoute(EmbedBuilderRoute.DeleteSaved, selectedId ?? ''))
     .setLabel(t.start.deleteSelected())
     .setEmoji(buttonEmoji(emotes.trash))
     .setDisabled(!selectedId),
   ),
  );
 }

 return new MessagePayload(this.client, { origin: this.name, reason: 'Embed builder start' })
  .setComponents([container.toJSON()])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

const confirmSurface = function (this: EmbedBuilderPlugin, content: string) {
 const container = new ContainerBuilder()
  .setAccentColor(Colors.Success)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

 return new MessagePayload(this.client, { origin: this.name, reason: 'Embed builder confirm' })
  .setComponents([container.toJSON()])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

export const openIntoThread = async function (
 this: EmbedBuilderPlugin,
 cmd: APIInteraction,
 embed: APIEmbed,
 respond: RespondMode,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);
 const api = await this.getInteractionAPI(cmd);
 const emotes = this.client.emojis.for(api);

 const result = await openThread.call(this, cmd, embed);
 const failNote =
  result instanceof RequestHandlerError
   ? (result.errorMessage ?? t.errors.noThread())
   : t.errors.noThread();
 const content =
  typeof result === 'string'
   ? `${textEmote(emotes.enabled)} ${t.start.threadCreated({ channel: `<#${result}>` })}`
   : `${textEmote(emotes.warning)} ${failNote}`;

 const payload = confirmSurface.call(this, content);
 if (respond === RespondMode.Reply) payload.reply(cmd);
 else payload.update(cmd);
};

export const startOpen = async function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandInteraction,
) {
 if (!cmd.guild_id) return;
 const payload = await buildStartSurface.call(this, cmd, null);
 payload.reply(cmd);
};

export const startFresh = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 await openIntoThread.call(this, cmd, {}, RespondMode.Update);
};

export const loadPick = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.StringSelect) return;

 const payload = await buildStartSurface.call(this, cmd, cmd.data.values[0] ?? null);
 payload.update(cmd);
};

export const loadOpen = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const row = await CustomEmbed.byId(this.client, args[0]);
 if (!row || row.guild !== cmd.guild_id) {
  ephemeralNote.call(this, cmd, t.errors.notFound());
  return;
 }

 await openIntoThread.call(this, cmd, (row.embed ?? {}) as APIEmbed, RespondMode.Update);
};

export const openFromAction = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;
 const t = await this.t(cmd.guild_id);

 const row = await CustomEmbed.byId(this.client, args[0]);
 if (!row || row.guild !== cmd.guild_id) {
  ephemeralNote.call(this, cmd, t.errors.notFound());
  return;
 }

 await openIntoThread.call(this, cmd, (row.embed ?? {}) as APIEmbed, RespondMode.Reply);
};

export const deleteSaved = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;
 const t = await this.t(cmd.guild_id);

 const row = await CustomEmbed.byId(this.client, args[0]);
 if (!row || row.guild !== cmd.guild_id) {
  ephemeralNote.call(this, cmd, t.errors.notFound());
  return;
 }

 try {
  await new CustomEmbed(this.client, cmd.guild_id, String(row.id)).remove();
 } catch (error) {
  this.nonFatalError(error as Error, 'deleteSaved');
  ephemeralNote.call(this, cmd, (error as Error).message);
  return;
 }

 const payload = await buildStartSurface.call(this, cmd, null);
 payload.update(cmd);
};
