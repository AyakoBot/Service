import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import {
 EmbedProperty,
 propertyInputs,
 PropertyInput,
 propertyLengths,
} from '../../Classes/Properties.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { applyErrorText } from '../../Util/applyErrorText.js';
import { applyProperty, currentValue } from '../../Util/applyProperty.js';
import { builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { renderBuilder, type BuilderView } from '../../Util/renderBuilder.js';

type Translator = Awaited<ReturnType<EmbedBuilderPlugin['t']>>;

const inputLengths: Record<PropertyInput, number> = {
 [PropertyInput.Typed]: 4096,
 [PropertyInput.Text]: 2048,
 [PropertyInput.Link]: 2048,
 [PropertyInput.Image]: 2048,
 [PropertyInput.Color]: 7,
 [PropertyInput.Toggle]: 8,
};

const inputPlaceholder = (t: Translator, input: PropertyInput): string => {
 switch (input) {
  case PropertyInput.Color:
   return t.modals.colorPlaceholder();
  case PropertyInput.Link:
  case PropertyInput.Image:
   return t.modals.urlPlaceholder();
  default:
   return t.modals.valueLabel();
 }
};

const propertyLabel = (t: Translator, property: EmbedProperty): string =>
 (t.properties as unknown as Record<EmbedProperty, () => string>)[property]();

export const openEditorModal = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 property: EmbedProperty,
 view: BuilderView,
) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const input = propertyInputs[property];
 const maxLength = propertyLengths[property] ?? inputLengths[input];
 const value = currentValue(view.embed, property, view.selectedField).slice(0, maxLength);

 const textInput = new TextInputBuilder()
  .setCustomId('value')
  .setStyle(maxLength > 1024 ? TextInputStyle.Paragraph : TextInputStyle.Short)
  .setRequired(false)
  .setMaxLength(maxLength)
  .setPlaceholder(inputPlaceholder(t, input).slice(0, 100));
 if (value) textInput.setValue(value);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.Editor, property))
  .setTitle(propertyLabel(t, property).slice(0, 45))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.modals.valueLabel())
    .setDescription(t.modals.valueHint())
    .setTextInputComponent(textInput),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening embed property editor',
 });
};

export const editorSave = async function (
 this: EmbedBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 const [property] = args;
 if (!(Object.values(EmbedProperty) as string[]).includes(property)) return;

 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const value = findModalValue(cmd.data.components, 'value') || null;

 const result = applyProperty(
  ctx.view.embed,
  property as EmbedProperty,
  value,
  ctx.view.selectedField,
 );
 if (!result.ok) {
  ephemeralNote.call(this, cmd, applyErrorText(t, result.error));
  return;
 }

 renderBuilder
  .call(this, t, { ...ctx.view, embed: result.embed, selectedProperty: null })
  .update(cmd);
};
