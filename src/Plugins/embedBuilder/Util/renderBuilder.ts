import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 EmbedBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
} from '@discordjs/builders';
import type { APIPartialEmoji } from '@discordjs/core';
import {
 ButtonStyle,
 ChannelType,
 type APIEmbed,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import emotes from '../../../Classes/Emotes.js';
import { Colors } from '../../../Types/index.js';
import { buttonEmoji, textEmote } from '../../settings/Util/settingsEmotes.js';
import {
 EmbedProperty,
 FieldOption,
 fieldLimit,
 fieldProperties,
 propertyInputs,
 PropertyInput,
 topLevelProperties,
} from '../Classes/Properties.js';
import { EmbedBuilderRoute } from '../Classes/Routes.js';
import type EmbedBuilderPlugin from '../Plugin.js';

import { currentValue } from './applyProperty.js';
import { buildMarkerUrl, isSendable, placeholderUrl, type BuilderMarker } from './builderState.js';

type Translator = Awaited<ReturnType<EmbedBuilderPlugin['t']>>;

export enum SendMode {
 Bot = 'bot',
 Webhook = 'webhook',
}

export interface BuilderView {
 marker: BuilderMarker;
 embed: APIEmbed;
 selectedField: number | null;
 selectedProperty: EmbedProperty | null;
 canManage: boolean;
}

const propertyEmotes: Record<EmbedProperty, APIPartialEmoji> = {
 [EmbedProperty.Title]: emotes.heading,
 [EmbedProperty.Description]: emotes.paragraph,
 [EmbedProperty.Url]: emotes.link,
 [EmbedProperty.Image]: emotes.image,
 [EmbedProperty.Thumbnail]: emotes.thumbnail,
 [EmbedProperty.Color]: emotes.palette,
 [EmbedProperty.AuthorName]: emotes.author,
 [EmbedProperty.AuthorIcon]: emotes.author,
 [EmbedProperty.AuthorUrl]: emotes.author,
 [EmbedProperty.FooterText]: emotes.footer,
 [EmbedProperty.FooterIcon]: emotes.footer,
 [EmbedProperty.Timestamp]: emotes.calendar,
 [EmbedProperty.FieldName]: emotes.fields,
 [EmbedProperty.FieldValue]: emotes.fields,
 [EmbedProperty.FieldInline]: emotes.fields,
};

const propertyLabel = (t: Translator, property: EmbedProperty): string =>
 (t.properties as unknown as Record<EmbedProperty, () => string>)[property]();

const previewValue = (t: Translator, view: BuilderView, property: EmbedProperty): string => {
 if (property === EmbedProperty.FieldInline) {
  const inline =
   view.selectedField !== null && Boolean(view.embed.fields?.[view.selectedField]?.inline);
  return inline ? t.base.t.Yes() : t.base.t.No();
 }

 const value = currentValue(view.embed, property, view.selectedField)
  .replace(/\s+/g, ' ')
  .trim();
 return value ? value.slice(0, 90) : t.builder.notSet();
};

const needsOneList = (t: Translator): string =>
 [
  EmbedProperty.Title,
  EmbedProperty.Description,
  EmbedProperty.AuthorName,
  EmbedProperty.Image,
  EmbedProperty.Thumbnail,
  EmbedProperty.FooterText,
  EmbedProperty.FieldName,
 ]
  .map((property) => `\`${propertyLabel(t, property)}\``)
  .join(', ');

const inputList = (t: Translator, inputs: PropertyInput[]): string =>
 topLevelProperties
  .concat(fieldProperties)
  .filter((property) => inputs.includes(propertyInputs[property]))
  .map((property) => propertyLabel(t, property))
  .join(', ');

const headerEmbed = function (this: EmbedBuilderPlugin, t: Translator, view: BuilderView) {
 const lines = [t.builder.desc()];

 if (view.selectedProperty && propertyInputs[view.selectedProperty] === PropertyInput.Typed) {
  lines.push(
   `${textEmote(emotes.timer)} ${t.builder.waitingFor({
    property: `**${propertyLabel(t, view.selectedProperty)}**`,
   })}`,
  );
 }
 if (!isSendable(view.embed)) {
  lines.push(`${textEmote(emotes.warning)} ${t.builder.needsOne({ list: needsOneList(t) })}`);
 }
 if (!view.canManage) lines.push(`${textEmote(emotes.lock)} ${t.builder.manageRequired()}`);

 return new EmbedBuilder()
  .setTitle(t.builder.title())
  .setURL(buildMarkerUrl(view.marker))
  .setColor(Colors.Info)
  .setDescription(lines.join('\n\n'))
  .addFields(
   {
    name: `${textEmote(emotes.paragraph)} ${t.builder.typedHere()}`,
    value: `${inputList(t, [PropertyInput.Typed])}\n-# ${t.builder.typedHint()}`,
    inline: true,
   },
   {
    name: `${textEmote(emotes.edit)} ${t.builder.viaModal()}`,
    value: `${inputList(t, [
     PropertyInput.Text,
     PropertyInput.Link,
     PropertyInput.Image,
     PropertyInput.Color,
     PropertyInput.Timestamp,
    ])}\n-# ${t.builder.modalHint()}`,
    inline: true,
   },
  );
};

const wipEmbed = (t: Translator, view: BuilderView): APIEmbed => {
 if (Object.keys(view.embed).length) return view.embed;
 return { description: t.builder.placeholder(), color: Colors.Ephemeral, url: placeholderUrl() };
};

const propertySelectRow = function (this: EmbedBuilderPlugin, t: Translator, view: BuilderView) {
 const onField = view.selectedField !== null;
 const properties = onField ? fieldProperties : topLevelProperties;

 const options = properties.map((property) =>
  new StringSelectMenuOptionBuilder()
   .setLabel(propertyLabel(t, property))
   .setValue(property)
   .setDescription(previewValue(t, view, property))
   .setEmoji(buttonEmoji(propertyEmotes[property]))
   .setDefault(property === view.selectedProperty),
 );

 if (onField) {
  options.push(
   new StringSelectMenuOptionBuilder()
    .setLabel(t.builder.removeField())
    .setValue(FieldOption.Remove)
    .setEmoji(buttonEmoji(emotes.trash)),
  );
 }

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.Property))
  .setPlaceholder(onField ? t.builder.fieldPropertyPlaceholder() : t.builder.propertyPlaceholder())
  .setMinValues(1)
  .setMaxValues(1)
  .addOptions(options);

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const fieldSelectRow = function (this: EmbedBuilderPlugin, t: Translator, view: BuilderView) {
 const options = (view.embed.fields ?? []).map((field, index) =>
  new StringSelectMenuOptionBuilder()
   .setLabel(t.builder.fieldNr({ nr: String(index + 1) }))
   .setValue(String(index))
   .setDescription(field.name.replace(/\s+/g, ' ').slice(0, 90) || t.builder.notSet())
   .setEmoji(buttonEmoji(emotes.fields))
   .setDefault(index === view.selectedField),
 );

 if (options.length < fieldLimit) {
  options.push(
   new StringSelectMenuOptionBuilder()
    .setLabel(t.builder.addField())
    .setValue(FieldOption.Add)
    .setEmoji(buttonEmoji(emotes.plus)),
  );
 }

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.Field))
  .setPlaceholder(t.builder.fieldPlaceholder())
  .setMinValues(0)
  .setMaxValues(1)
  .addOptions(options);

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const utilityRow = function (this: EmbedBuilderPlugin, t: Translator) {
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(EmbedBuilderRoute.Empty))
   .setLabel(t.base.t.Empty())
   .setEmoji(buttonEmoji(emotes.trash)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(EmbedBuilderRoute.ImportJson))
   .setLabel(t.base.t.Import())
   .setEmoji(buttonEmoji(emotes.json)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(EmbedBuilderRoute.ExportJson))
   .setLabel(t.base.t.Export())
   .setEmoji(buttonEmoji(emotes.json)),
 );
};

const actionRow = function (this: EmbedBuilderPlugin, t: Translator, view: BuilderView) {
 const locked = !view.canManage || !isSendable(view.embed);

 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(EmbedBuilderRoute.Save))
   .setLabel(t.base.t.Save())
   .setEmoji(buttonEmoji(emotes.save))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(EmbedBuilderRoute.Send))
   .setLabel(t.base.t.Send())
   .setEmoji(buttonEmoji(emotes.send))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Primary)
   .setCustomId(this.getRoute(EmbedBuilderRoute.EditMessage))
   .setLabel(t.builder.editMessage())
   .setEmoji(buttonEmoji(emotes.edit))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Danger)
   .setCustomId(this.getRoute(EmbedBuilderRoute.CloseThread))
   .setLabel(t.base.t.Close()),
 );
};

export const builderRows = function (
 this: EmbedBuilderPlugin,
 t: Translator,
 view: BuilderView,
): APIMessageTopLevelComponent[] {
 return [
  propertySelectRow.call(this, t, view),
  fieldSelectRow.call(this, t, view),
  utilityRow.call(this, t),
  actionRow.call(this, t, view),
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

export const sendRows = function (
 this: EmbedBuilderPlugin,
 t: Translator,
 mode: SendMode,
): APIMessageTopLevelComponent[] {
 const webhook = mode === SendMode.Webhook;

 const select = new ChannelSelectMenuBuilder()
  .setCustomId(
   this.getRoute(webhook ? EmbedBuilderRoute.WebhookSendTo : EmbedBuilderRoute.SendTo),
  )
  .setPlaceholder(webhook ? t.send.webhookPlaceholder() : t.send.placeholder())
  .setChannelTypes(
   ...(webhook
    ? [ChannelType.GuildText, ChannelType.GuildAnnouncement]
    : [
       ChannelType.GuildText,
       ChannelType.GuildAnnouncement,
       ChannelType.PublicThread,
       ChannelType.PrivateThread,
      ]),
  )
  .setMinValues(1)
  .setMaxValues(webhook ? 5 : 25);

 const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(EmbedBuilderRoute.Back))
   .setLabel(t.base.t.Back())
   .setEmoji(buttonEmoji(emotes.back)),
 );

 if (mode === SendMode.Bot) {
  buttons.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setCustomId(this.getRoute(EmbedBuilderRoute.WebhookModal))
    .setLabel(t.send.asWebhook())
    .setEmoji(buttonEmoji(emotes.webhook)),
  );
 }

 return [
  new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
  buttons,
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

export const renderBuilder = function (
 this: EmbedBuilderPlugin,
 t: Translator,
 view: BuilderView,
 rows?: APIMessageTopLevelComponent[],
): MessagePayload {
 return new MessagePayload(this.client, { origin: this.name, reason: 'Embed builder surface' })
  .setContent(`<@${view.marker.execId}>`)
  .setAllowedMentionsUsers([view.marker.execId])
  .setEmbeds([headerEmbed.call(this, t, view).toJSON(), wipEmbed(t, view)])
  .setComponents(rows ?? builderRows.call(this, t, view));
};
