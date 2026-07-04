import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 SeparatorBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import type { APIPartialEmoji } from '@discordjs/core';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import emotes from '../../../Classes/Emotes.js';
import { cleanPreview } from '../../../Util/cleanPreview.js';
import { buttonEmoji, textEmote } from '../../settings/Util/settingsEmotes.js';
import {
 NodeAction,
 NodeKind,
 rowButtonLimit,
 sectionTextLimit,
 wipComponentLimit,
} from '../Classes/Nodes.js';
import { ComponentBuilderRoute } from '../Classes/Routes.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import { applyErrorText } from './applyErrorText.js';
import type { BuilderView } from './builderContext.js';
import {
 buildMarkerUrl,
 ChromeComponentId,
 isSendable,
 type BuilderMarker,
} from './builderState.js';
import {
 countComponents,
 flattenTree,
 getNode,
 isAccessoryPath,
 kindOf,
 makeText,
 validateTree,
 type WipNode,
} from './componentTree.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

export enum SendMode {
 Bot = 'bot',
 Webhook = 'webhook',
}

const previewLimit = 90;

const kindEmotes: Record<NodeKind, APIPartialEmoji> = {
 [NodeKind.Text]: emotes.paragraph,
 [NodeKind.Container]: emotes.channelcategory,
 [NodeKind.Section]: emotes.heading,
 [NodeKind.Separator]: emotes.footer,
 [NodeKind.Gallery]: emotes.image,
 [NodeKind.Row]: emotes.command,
 [NodeKind.Button]: emotes.enabled,
 [NodeKind.StringSelect]: emotes.fields,
 [NodeKind.UserSelect]: emotes.member,
 [NodeKind.RoleSelect]: emotes.role,
 [NodeKind.ChannelSelect]: emotes.channelthread,
 [NodeKind.MentionableSelect]: emotes.member,
 [NodeKind.Thumbnail]: emotes.thumbnail,
};

const kindLabel = (t: Translator, kind: NodeKind): string =>
 (t.kinds as unknown as Record<NodeKind, () => string>)[kind]();

const actionLabel = (t: Translator, action: NodeAction): string =>
 (t.actions as unknown as Record<NodeAction, () => string>)[action]();

const nodePreview = (t: Translator, node: WipNode): string => {
 const text = (value: string | undefined | null): string =>
  (value ? cleanPreview(value).replace(/\s+/g, ' ').trim().slice(0, previewLimit) : '');

 switch (node.type) {
  case ComponentType.TextDisplay:
   return text(node.content);
  case ComponentType.Button:
   if ('sku_id' in node) return '';
   return 'url' in node ? text(`${node.label} → ${node.url}`) : text(node.label);
  case ComponentType.StringSelect:
  case ComponentType.UserSelect:
  case ComponentType.RoleSelect:
  case ComponentType.ChannelSelect:
  case ComponentType.MentionableSelect:
   return text(node.placeholder) || text(node.custom_id);
  case ComponentType.Section:
   return text(node.components[0]?.content);
  case ComponentType.Container:
   return t.builder.childCount({ count: String(node.components.length) });
  case ComponentType.ActionRow:
   return t.builder.childCount({ count: String(node.components.length) });
  case ComponentType.MediaGallery:
   return t.builder.itemCount({ count: String(node.items.length) });
  case ComponentType.Thumbnail:
   return text(node.media.url);
  case ComponentType.Separator:
   return node.divider === false ? t.builder.spacingOnly() : t.builder.dividerLine();
  default:
   return '';
 }
};

const rootAddActions = [
 NodeAction.AddText,
 NodeAction.AddContainer,
 NodeAction.AddSectionButton,
 NodeAction.AddSectionThumbnail,
 NodeAction.AddSeparator,
 NodeAction.AddGallery,
 NodeAction.AddButton,
 NodeAction.AddStringSelect,
 NodeAction.AddUserSelect,
 NodeAction.AddRoleSelect,
 NodeAction.AddChannelSelect,
 NodeAction.AddMentionableSelect,
];

const containerAddActions = rootAddActions.filter(
 (action) => action !== NodeAction.AddContainer,
);

const structureActions = [NodeAction.MoveUp, NodeAction.MoveDown, NodeAction.Remove];

const nodeActions = (node: WipNode): NodeAction[] => {
 switch (kindOf(node)) {
  case NodeKind.Text:
   return [NodeAction.Edit, ...structureActions];
  case NodeKind.Container:
   return [NodeAction.Edit, NodeAction.ToggleSpoiler, ...containerAddActions,
    ...structureActions];
  case NodeKind.Section: {
   const section = node as Extract<WipNode, { type: ComponentType.Section }>;
   const adds = section.components.length < sectionTextLimit ? [NodeAction.AddTextChild] : [];
   return [...adds, NodeAction.AccessoryButton, NodeAction.AccessoryThumbnail,
    ...structureActions];
  }
  case NodeKind.Separator:
   return [NodeAction.ToggleDivider, NodeAction.ToggleSpacing, ...structureActions];
  case NodeKind.Gallery:
   return [NodeAction.Edit, ...structureActions];
  case NodeKind.Row: {
   const row = node as Extract<WipNode, { type: ComponentType.ActionRow }>;
   const allButtons = row.components.every((child) => kindOf(child) === NodeKind.Button);
   const adds =
    allButtons && row.components.length < rowButtonLimit ? [NodeAction.AddButton] : [];
   return [...adds, ...structureActions];
  }
  case NodeKind.Button:
   return [
    NodeAction.Edit,
    NodeAction.StylePrimary,
    NodeAction.StyleSecondary,
    NodeAction.StyleSuccess,
    NodeAction.StyleDanger,
    NodeAction.StyleLink,
    NodeAction.ToggleDisabled,
    ...structureActions,
   ];
  case NodeKind.StringSelect:
   return [NodeAction.Edit, NodeAction.EditOptions, NodeAction.ToggleDisabled,
    ...structureActions];
  case NodeKind.UserSelect:
  case NodeKind.RoleSelect:
  case NodeKind.ChannelSelect:
  case NodeKind.MentionableSelect:
   return [NodeAction.Edit, NodeAction.ToggleDisabled, ...structureActions];
  case NodeKind.Thumbnail:
   return [NodeAction.Edit, NodeAction.ToggleSpoiler, ...structureActions];
  default:
   return [];
 }
};

export const actionsFor = (view: BuilderView): NodeAction[] => {
 const node = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 if (!node || !view.selectedPath) {
  return countComponents(view.tree) >= wipComponentLimit ? [] : rootAddActions;
 }

 const actions = nodeActions(node);
 if (!isAccessoryPath(view.selectedPath)) return actions;
 return actions.filter((action) => !structureActions.includes(action));
};

const markerLinkButton = (marker: BuilderMarker): ButtonBuilder =>
 new ButtonBuilder()
  .setStyle(ButtonStyle.Link)
  .setURL(buildMarkerUrl(marker))
  .setEmoji(buttonEmoji(emotes.info));

const nodeSelectRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 const entries = flattenTree(view.tree);

 const options = entries.slice(0, 25).map((entry) => {
  const kind = kindOf(entry.node);
  const option = new StringSelectMenuOptionBuilder()
   .setLabel(
    `${'· '.repeat(entry.depth)}${kind ? kindLabel(t, kind) : '?'}`.slice(0, 100),
   )
   .setValue(entry.path)
   .setDefault(entry.path === view.selectedPath);
  if (kind) option.setEmoji(buttonEmoji(kindEmotes[kind]));

  const preview = nodePreview(t, entry.node);
  if (preview) option.setDescription(preview.slice(0, 100));
  return option;
 });

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.Node))
  .setPlaceholder(t.builder.nodePlaceholder())
  .setMinValues(0)
  .setMaxValues(1);

 if (options.length) { select.addOptions(options); } else {
  select
   .setDisabled(true)
   .addOptions(new StringSelectMenuOptionBuilder().setLabel('-').setValue('-'));
 }

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const actionSelectRow = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
) {
 const actions = actionsFor(view);

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.Action))
  .setPlaceholder(
   view.selectedPath ? t.builder.actionPlaceholder() : t.builder.addPlaceholder(),
  )
  .setMinValues(1)
  .setMaxValues(1);

 if (actions.length) {
  select.addOptions(
   actions.map((action) =>
    new StringSelectMenuOptionBuilder()
     .setLabel(actionLabel(t, action).slice(0, 100))
     .setValue(action),
   ),
  );
 } else {
  select
   .setDisabled(true)
   .addOptions(new StringSelectMenuOptionBuilder().setLabel('-').setValue('-'));
 }

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const utilityRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Empty))
   .setLabel(t.base.t.Empty())
   .setEmoji(buttonEmoji(emotes.trash)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.ImportJson))
   .setLabel(t.base.t.Import())
   .setEmoji(buttonEmoji(emotes.json)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.ExportJson))
   .setLabel(t.base.t.Export())
   .setEmoji(buttonEmoji(emotes.json)),
  markerLinkButton(view.marker),
 );
};

const actionRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 const locked = !view.canManage || !isSendable(view.tree);

 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Save))
   .setLabel(t.base.t.Save())
   .setEmoji(buttonEmoji(emotes.save))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Send))
   .setLabel(t.base.t.Send())
   .setEmoji(buttonEmoji(emotes.send))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Primary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.EditMessage))
   .setLabel(t.builder.editMessage())
   .setEmoji(buttonEmoji(emotes.edit))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Danger)
   .setCustomId(this.getRoute(ComponentBuilderRoute.CloseThread))
   .setLabel(t.base.t.Close()),
 );
};

export const builderRows = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
): APIMessageTopLevelComponent[] {
 return [
  nodeSelectRow.call(this, t, view),
  actionSelectRow.call(this, t, view),
  utilityRow.call(this, t, view),
  actionRow.call(this, t, view),
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

export const sendRows = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 mode: SendMode,
): APIMessageTopLevelComponent[] {
 const webhook = mode === SendMode.Webhook;

 const select = new ChannelSelectMenuBuilder()
  .setCustomId(
   this.getRoute(
    webhook ? ComponentBuilderRoute.WebhookSendTo : ComponentBuilderRoute.SendTo,
   ),
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
   .setCustomId(this.getRoute(ComponentBuilderRoute.Back))
   .setLabel(t.base.t.Back())
   .setEmoji(buttonEmoji(emotes.back)),
 );

 if (mode === SendMode.Bot) {
  buttons.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setCustomId(this.getRoute(ComponentBuilderRoute.WebhookModal))
    .setLabel(t.send.asWebhook())
    .setEmoji(buttonEmoji(emotes.webhook)),
  );
 }

 buttons.addComponents(markerLinkButton(view.marker));

 return [
  new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
  buttons,
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

const headerText = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 const lines = [
  `# ${textEmote(emotes.json)} ${t.builder.title()} · <@${view.marker.execId}>`,
  t.builder.desc(),
 ];

 const selected = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 if (selected && kindOf(selected) === NodeKind.Text) {
  lines.push(`${textEmote(emotes.timer)} ${t.builder.waitingForText()}`);
 }

 const validationError = view.tree.length ? validateTree(view.tree) : null;
 if (!view.tree.length) {
  lines.push(`${textEmote(emotes.warning)} ${t.builder.needsComponent()}`);
 } else if (validationError) {
  lines.push(`${textEmote(emotes.warning)} ${applyErrorText(t, validationError)}`);
 }

 if (!view.canManage) lines.push(`${textEmote(emotes.lock)} ${t.builder.manageRequired()}`);

 lines.push(
  `-# ${t.builder.componentCount({
   count: String(countComponents(view.tree)),
   limit: String(wipComponentLimit),
  })}`,
 );

 return new TextDisplayBuilder().setContent(lines.join('\n\n'));
};

export const renderBuilder = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 rows?: APIMessageTopLevelComponent[],
): MessagePayload {
 const wip: APIMessageTopLevelComponent[] = view.tree.length
  ? view.tree
  : [
     {
      ...makeText(t.builder.placeholder()),
      id: ChromeComponentId.Placeholder,
     },
    ];

 return new MessagePayload(this.client, { origin: this.name, reason: 'Component builder surface' })
  .setAllowedMentionsUsers([view.marker.execId])
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([
   headerText.call(this, t, view).toJSON() as unknown as APIMessageTopLevelComponent,
   ...(rows ?? builderRows.call(this, t, view)),
   new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Large)
    .setId(ChromeComponentId.Boundary)
    .toJSON() as unknown as APIMessageTopLevelComponent,
   ...wip,
  ]);
};
