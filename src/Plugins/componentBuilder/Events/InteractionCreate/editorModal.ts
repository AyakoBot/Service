import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 ComponentType,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { MediaAddKind, NodeKind } from '../../Classes/Nodes.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { applyErrorText } from '../../Util/applyErrorText.js';
import {
 applyButton,
 applyContainer,
 applyGallery,
 applySelect,
 applySelectOptions,
 applyText,
 applyThumbnail,
 parseGalleryLines,
} from '../../Util/applyNode.js';
import { builderContext, ephemeralNote, type BuilderView } from '../../Util/builderContext.js';
import {
 BuilderErrorCode,
 getNode,
 insertNode,
 kindOf,
 makeGallery,
 makeSectionWithThumbnail,
 makeThumbnail,
 parseHttpUrl,
 setAccessory,
 textContentLimit,
 type TreeResult,
 type WipNode,
} from '../../Util/componentTree.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

enum ModalField {
 Content = 'content',
 Color = 'color',
 Url = 'url',
 Alt = 'alt',
 Label = 'label',
 CustomId = 'customId',
 Placeholder = 'placeholder',
 Min = 'min',
 Max = 'max',
 Lines = 'lines',
}

const shortInput = (
 id: ModalField,
 required: boolean,
 maxLength: number,
 value?: string,
): TextInputBuilder => {
 const input = new TextInputBuilder()
  .setCustomId(id)
  .setStyle(TextInputStyle.Short)
  .setRequired(required)
  .setMaxLength(maxLength);
 if (value) input.setValue(value.slice(0, maxLength));
 return input;
};

const paragraphInput = (
 id: ModalField,
 required: boolean,
 maxLength: number,
 value?: string,
): TextInputBuilder => {
 const input = new TextInputBuilder()
  .setCustomId(id)
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(required)
  .setMaxLength(maxLength);
 if (value) input.setValue(value.slice(0, maxLength));
 return input;
};

const labeled = (label: string, hint: string, input: TextInputBuilder): LabelBuilder =>
 new LabelBuilder()
  .setLabel(label.slice(0, 45))
  .setDescription(hint.slice(0, 100))
  .setTextInputComponent(input);

const galleryLines = (node: WipNode): string =>
 (node.type === ComponentType.MediaGallery
  ? node.items
     .map((item) => [item.media.url, item.description].filter(Boolean).join(' | '))
     .join('\n')
  : '');

const optionLines = (node: WipNode): string =>
 (node.type === ComponentType.StringSelect
  ? node.options
     .map((option) =>
      [option.label, option.value, option.description].filter(Boolean).join(' | '),
     )
     .join('\n')
  : '');

const editModalFor = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 node: WipNode,
 path: string,
): ModalBuilder | null {
 const modal = new ModalBuilder().setCustomId(
  this.getRoute(ComponentBuilderRoute.EditorSave, path, kindOf(node) ?? ''),
 );

 switch (node.type) {
  case ComponentType.TextDisplay:
   return modal
    .setTitle(t.modals.textTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.contentLabel(),
      t.modals.contentHint(),
      paragraphInput(ModalField.Content, true, textContentLimit, node.content),
     ),
    );
  case ComponentType.Container: {
   const color =
    typeof node.accent_color === 'number'
     ? `#${node.accent_color.toString(16).padStart(6, '0')}`
     : undefined;
   return modal
    .setTitle(t.modals.containerTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.colorLabel(),
      t.modals.colorHint(),
      shortInput(ModalField.Color, false, 7, color),
     ),
    );
  }
  case ComponentType.Thumbnail:
   return modal
    .setTitle(t.modals.thumbnailTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.urlLabel(),
      t.modals.urlHint(),
      shortInput(ModalField.Url, true, 1024, node.media.url),
     ),
     labeled(
      t.modals.altLabel(),
      t.modals.optionalHint(),
      shortInput(ModalField.Alt, false, 256, node.description ?? undefined),
     ),
    );
  case ComponentType.MediaGallery:
   return modal
    .setTitle(t.modals.galleryTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.galleryLabel(),
      t.modals.galleryHint(),
      paragraphInput(ModalField.Lines, true, 4000, galleryLines(node)),
     ),
    );
  case ComponentType.Button: {
   if ('sku_id' in node) return null;
   const isLink = 'url' in node;
   return modal
    .setTitle(t.modals.buttonTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.labelLabel(),
      t.modals.contentHint(),
      shortInput(ModalField.Label, true, 80, node.label),
     ),
     isLink
      ? labeled(
         t.modals.urlLabel(),
         t.modals.urlHint(),
         shortInput(ModalField.Url, true, 512, node.url),
        )
      : labeled(
         t.modals.customIdLabel(),
         t.modals.customIdHint(),
         shortInput(ModalField.CustomId, true, 100, node.custom_id),
        ),
    );
  }
  case ComponentType.StringSelect:
  case ComponentType.UserSelect:
  case ComponentType.RoleSelect:
  case ComponentType.ChannelSelect:
  case ComponentType.MentionableSelect:
   return modal
    .setTitle(t.modals.selectTitle().slice(0, 45))
    .addLabelComponents(
     labeled(
      t.modals.customIdLabel(),
      t.modals.customIdHint(),
      shortInput(ModalField.CustomId, true, 100, node.custom_id),
     ),
     labeled(
      t.modals.placeholderLabel(),
      t.modals.optionalHint(),
      shortInput(ModalField.Placeholder, false, 150, node.placeholder ?? undefined),
     ),
     labeled(
      t.modals.minLabel(),
      t.modals.numberHint(),
      shortInput(ModalField.Min, false, 2, String(node.min_values ?? 1)),
     ),
     labeled(
      t.modals.maxLabel(),
      t.modals.numberHint(),
      shortInput(ModalField.Max, false, 2, String(node.max_values ?? 1)),
     ),
    );
  default:
   return null;
 }
};

const showModal = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 modal: ModalBuilder,
) {
 if (!cmd.guild_id) return;
 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening component editor modal',
 });
};

export const openEditModal = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) {
 if (!view.selectedPath) return;
 const node = getNode(view.tree, view.selectedPath);
 if (!node) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const modal = editModalFor.call(this, t, node, view.selectedPath);
 if (!modal) return;

 await showModal.call(this, cmd, modal);
};

export const openOptionsModal = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) {
 if (!view.selectedPath) return;
 const node = getNode(view.tree, view.selectedPath);
 if (node?.type !== ComponentType.StringSelect) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.OptionsSave, view.selectedPath))
  .setTitle(t.modals.optionsTitle().slice(0, 45))
  .addLabelComponents(
   labeled(
    t.modals.optionsLabel(),
    t.modals.optionsHint(),
    paragraphInput(ModalField.Lines, true, 4000, optionLines(node)),
   ),
  );

 await showModal.call(this, cmd, modal);
};

export const openMediaModal = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 kind: MediaAddKind,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 const modal = new ModalBuilder().setCustomId(
  this.getRoute(ComponentBuilderRoute.MediaAddSave, kind),
 );

 if (kind === MediaAddKind.Gallery) {
  modal
   .setTitle(t.modals.galleryTitle().slice(0, 45))
   .addLabelComponents(
    labeled(
     t.modals.galleryLabel(),
     t.modals.galleryHint(),
     paragraphInput(ModalField.Lines, true, 4000),
    ),
   );
 } else {
  modal
   .setTitle(t.modals.thumbnailTitle().slice(0, 45))
   .addLabelComponents(
    labeled(t.modals.urlLabel(), t.modals.urlHint(), shortInput(ModalField.Url, true, 1024)),
    labeled(
     t.modals.altLabel(),
     t.modals.optionalHint(),
     shortInput(ModalField.Alt, false, 256),
    ),
   );
 }

 await showModal.call(this, cmd, modal);
};

const rerenderModal = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 view: BuilderView,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 renderBuilder.call(this, t, view).update(cmd);
};

const modalFail = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 error: BuilderErrorCode,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 ephemeralNote.call(this, cmd, applyErrorText(t, error));
};

const value = (cmd: APIModalSubmitInteraction, field: ModalField): string =>
 findModalValue(cmd.data.components, field) ?? '';

export const editorSave = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 const [path, expectedKind] = args;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx || !path) return;

 const node = getNode(ctx.view.tree, path);
 if (!node) return;
 if (expectedKind && kindOf(node) !== expectedKind) {
  await modalFail.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return;
 }

 const result = ((): TreeResult | null => {
  switch (node.type) {
   case ComponentType.TextDisplay:
    return applyText(ctx.view.tree, path, value(cmd, ModalField.Content));
   case ComponentType.Container:
    return applyContainer(ctx.view.tree, path, value(cmd, ModalField.Color));
   case ComponentType.Thumbnail:
    return applyThumbnail(
     ctx.view.tree,
     path,
     value(cmd, ModalField.Url),
     value(cmd, ModalField.Alt),
    );
   case ComponentType.MediaGallery:
    return applyGallery(ctx.view.tree, path, value(cmd, ModalField.Lines));
   case ComponentType.Button:
    return applyButton(
     ctx.view.tree,
     path,
     value(cmd, ModalField.Label),
     value(cmd, ModalField.Url) || value(cmd, ModalField.CustomId),
    );
   case ComponentType.StringSelect:
   case ComponentType.UserSelect:
   case ComponentType.RoleSelect:
   case ComponentType.ChannelSelect:
   case ComponentType.MentionableSelect:
    return applySelect(
     ctx.view.tree,
     path,
     value(cmd, ModalField.CustomId),
     value(cmd, ModalField.Placeholder),
     value(cmd, ModalField.Min),
     value(cmd, ModalField.Max),
    );
   default:
    return null;
  }
 })();

 if (!result) return;
 if (!result.ok) {
  await modalFail.call(this, cmd, result.error);
  return;
 }

 await rerenderModal.call(this, cmd, { ...ctx.view, tree: result.tree });
};

export const optionsSave = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 const [path] = args;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx || !path) return;

 const result = applySelectOptions(ctx.view.tree, path, value(cmd, ModalField.Lines));
 if (!result.ok) {
  await modalFail.call(this, cmd, result.error);
  return;
 }

 await rerenderModal.call(this, cmd, { ...ctx.view, tree: result.tree });
};

export const mediaAddSave = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 const [kind] = args;
 if (!(Object.values(MediaAddKind) as string[]).includes(kind)) return;

 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;
 const { view } = ctx;
 const t = await this.t(cmd.guild_id ?? undefined);

 const selected = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 const selectedKind = selected ? kindOf(selected) : null;
 const parentPath = selectedKind === NodeKind.Container ? (view.selectedPath ?? '') : '';

 const url = parseHttpUrl(value(cmd, ModalField.Url).trim());
 if (kind !== MediaAddKind.Gallery && !url) {
  await modalFail.call(this, cmd, BuilderErrorCode.InvalidUrl);
  return;
 }

 const result = ((): TreeResult => {
  switch (kind as MediaAddKind) {
   case MediaAddKind.Gallery: {
    const items = parseGalleryLines(value(cmd, ModalField.Lines));
    if (!Array.isArray(items)) return { ok: false, error: items };
    return insertNode(view.tree, parentPath, makeGallery(items));
   }
   case MediaAddKind.SectionThumbnail:
    return insertNode(
     view.tree,
     parentPath,
     makeSectionWithThumbnail(t.defaults.text(), url ?? ''),
    );
   case MediaAddKind.AccessoryThumbnail: {
    if (!view.selectedPath || selectedKind !== NodeKind.Section) {
     return { ok: false, error: BuilderErrorCode.NotAllowedHere };
    }
    return setAccessory(
     view.tree,
     view.selectedPath,
     makeThumbnail(url ?? '', value(cmd, ModalField.Alt).trim() || undefined),
    );
   }
   default:
    return { ok: false, error: BuilderErrorCode.NotAllowedHere };
  }
 })();

 if (!result.ok) {
  await modalFail.call(this, cmd, result.error);
  return;
 }

 await rerenderModal.call(this, cmd, { ...ctx.view, tree: result.tree });
};
