import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import {
 EmbedProperty,
 FieldOption,
 fieldLimit,
 propertyInputs,
 PropertyInput,
} from '../../Classes/Properties.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { applyErrorText } from '../../Util/applyErrorText.js';
import { applyProperty, blank } from '../../Util/applyProperty.js';
import { builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { renderBuilder, type BuilderView } from '../../Util/renderBuilder.js';

import { openEditorModal } from './editorModal.js';

const rerender = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 renderBuilder.call(this, t, view).update(cmd);
};

export const propertyPick = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const [value] = cmd.data.values;

 if (value === FieldOption.Back) {
  await rerender.call(this, cmd, { ...ctx.view, selectedField: null, selectedProperty: null });
  return;
 }

 if (value === FieldOption.Remove) {
  if (ctx.view.selectedField !== null) {
   ctx.view.embed.fields?.splice(ctx.view.selectedField, 1);
   if (!ctx.view.embed.fields?.length) delete ctx.view.embed.fields;
  }
  await rerender.call(this, cmd, { ...ctx.view, selectedField: null, selectedProperty: null });
  return;
 }

 if (!(Object.values(EmbedProperty) as string[]).includes(value)) return;
 const property = value as EmbedProperty;

 switch (propertyInputs[property]) {
  case PropertyInput.Typed:
   await rerender.call(this, cmd, { ...ctx.view, selectedProperty: property });
   return;
  case PropertyInput.Toggle: {
   const result = applyProperty(ctx.view.embed, property, null, ctx.view.selectedField);
   if (!result.ok) {
    const t = await this.t(cmd.guild_id ?? undefined);
    ephemeralNote.call(this, cmd, applyErrorText(t, result.error));
    return;
   }
   await rerender.call(this, cmd, {
    ...ctx.view,
    embed: result.embed,
    selectedProperty: null,
   });
   return;
  }
  default:
   await openEditorModal.call(this, cmd, property, ctx.view);
 }
};

export const fieldPick = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const [value] = cmd.data.values;
 const view: BuilderView = { ...ctx.view, selectedProperty: null };

 if (value === undefined) { view.selectedField = null; } else if (value === FieldOption.Add) {
  const fields = view.embed.fields ?? [];
  if (fields.length < fieldLimit) {
   fields.push({ name: blank, value: blank });
   view.embed.fields = fields;
   view.selectedField = fields.length - 1;
  }
 } else if (/^\d+$/.test(value)) { view.selectedField = Number(value); }

 await rerender.call(this, cmd, view);
};

export const emptyBuilder = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await rerender.call(this, cmd, {
  ...ctx.view,
  embed: {},
  selectedField: null,
  selectedProperty: null,
 });
};

export const emptyField = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const { selectedField } = ctx.view;
 if (selectedField === null || !ctx.view.embed.fields?.[selectedField]) return;

 ctx.view.embed.fields[selectedField] = { name: blank, value: blank };

 await rerender.call(this, cmd, { ...ctx.view, selectedProperty: null });
};

export const backToBuilder = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await rerender.call(this, cmd, {
  ...ctx.view,
  marker: { execId: ctx.view.marker.execId },
 });
};

export const closeThread = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id || !cmd.channel) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const api = await this.getAPI(cmd.guild_id);
 await api.interactions.deferMessageUpdate(cmd.id, cmd.token, undefined, {
  origin: this.name,
  reason: 'Acknowledging builder close',
 });
 await api.channels.delete(cmd.channel.id, {
  origin: this.name,
  reason: 'Closing embed builder thread',
 });
};
