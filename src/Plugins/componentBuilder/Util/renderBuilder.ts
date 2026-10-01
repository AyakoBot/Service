import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 SectionBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ChannelType,
 ComponentType,
 MessageFlags,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { cleanPreview } from '../../../Util/cleanPreview.js';
import { buttonEmoji, textEmote } from '../../settings/Util/settingsEmotes.js';
import { NodeAction, NodeKind, wipComponentLimit } from '../Classes/Nodes.js';
import { ComponentBuilderRoute } from '../Classes/Routes.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import {
 addedKinds,
 AddPosition,
 addTargetArgs,
 affordableActions,
 positionsFor,
 resolvePlacement,
 type AddTarget,
} from './addTarget.js';
import { applyErrorText } from './applyErrorText.js';
import type { BuilderView } from './builderContext.js';
import { buildMarkerUrl, ChromeComponentId, isSendable } from './builderState.js';
import {
 countComponents,
 flattenTree,
 getNode,
 kindOf,
 makeText,
 validateTree,
 type WipNode,
 type WipTree,
} from './componentTree.js';
import { actionRowsFor, isActionDisabled, styleOptions, toggleState } from './nodeActions.js';
import { lastNodePage, NodePageNav, nodePageSize, shownNodePage } from './nodePaging.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

export enum SendMode {
 Bot = 'bot',
 Webhook = 'webhook',
}

const previewLimit = 90;

const kindEmotes: Record<NodeKind, EmoteName> = {
 [NodeKind.Text]: EmoteName.Paragraph,
 [NodeKind.Container]: EmoteName.ChannelCategory,
 [NodeKind.Section]: EmoteName.Heading,
 [NodeKind.Separator]: EmoteName.Footer,
 [NodeKind.Gallery]: EmoteName.Image,
 [NodeKind.Row]: EmoteName.Command,
 [NodeKind.Button]: EmoteName.Enabled,
 [NodeKind.StringSelect]: EmoteName.Fields,
 [NodeKind.UserSelect]: EmoteName.Member,
 [NodeKind.RoleSelect]: EmoteName.Role,
 [NodeKind.ChannelSelect]: EmoteName.ChannelThread,
 [NodeKind.MentionableSelect]: EmoteName.Member,
 [NodeKind.Thumbnail]: EmoteName.Thumbnail,
};

const kindLabel = (t: Translator, kind: NodeKind): string =>
 (t.kinds as unknown as Record<NodeKind, () => string>)[kind]();

const actionLabel = (t: Translator, action: NodeAction): string =>
 (t.actions as unknown as Record<NodeAction, () => string>)[action]();

const nodePreview = (t: Translator, node: WipNode): string => {
 const text = (value: string | undefined | null): string =>
  value ? cleanPreview(value).replace(/\s+/g, ' ').trim().slice(0, previewLimit) : '';

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

const actionStyles: Partial<Record<NodeAction, ButtonStyle>> = {
 [NodeAction.Edit]: ButtonStyle.Primary,
 [NodeAction.Add]: ButtonStyle.Success,
 [NodeAction.Remove]: ButtonStyle.Danger,
};

const actionEmotes: Partial<Record<NodeAction, EmoteName>> = {
 [NodeAction.Edit]: EmoteName.Edit,
 [NodeAction.EditOptions]: EmoteName.Fields,
 [NodeAction.Style]: EmoteName.Palette,
 [NodeAction.Add]: EmoteName.Plus,
 [NodeAction.Remove]: EmoteName.Trash,
 [NodeAction.AccessoryButton]: EmoteName.Command,
 [NodeAction.AccessoryThumbnail]: kindEmotes[NodeKind.Thumbnail],
 [NodeAction.StyleLink]: EmoteName.Link,
};

const positionLabel = (t: Translator, position: AddPosition): string => {
 const labels: Record<AddPosition, () => string> = {
  [AddPosition.Inside]: t.base.t.Inside,
  [AddPosition.After]: t.base.t.After,
  [AddPosition.End]: t.add.atEnd,
 };
 return labels[position]();
};

const nodeName = (t: Translator, node: WipNode): string => {
 const kind = kindOf(node);
 return [`**${kind ? kindLabel(t, kind) : '?'}**`, nodePreview(t, node)]
  .filter(Boolean)
  .join(' · ');
};

const targetLine = (t: Translator, view: BuilderView, target: AddTarget): string => {
 const anchorPath = resolvePlacement(view.tree, target)?.anchor;
 const anchor = anchorPath ? getNode(view.tree, anchorPath) : null;
 if (!anchor) return t.add.targetEnd();

 const component = nodeName(t, anchor);
 if (target.position === AddPosition.Inside) return t.add.targetInside({ component });

 const selected = target.selectedPath ? getNode(view.tree, target.selectedPath) : null;
 return selected && anchorPath !== target.selectedPath
  ? t.add.targetAfterHolder({ component, selected: nodeName(t, selected) })
  : t.add.targetAfter({ component });
};

const markerLinkButton = (view: BuilderView): ButtonBuilder =>
 new ButtonBuilder()
  .setStyle(ButtonStyle.Link)
  .setURL(buildMarkerUrl(view.marker))
  .setEmoji(buttonEmoji(view.emotes.info))
  .setDisabled(true);

const nodeSelectRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 const entries = flattenTree(view.tree);
 const page = shownNodePage(entries, view.selectedPath, view.nodePage);

 const options = entries.slice(page * nodePageSize, (page + 1) * nodePageSize).map((entry) => {
  const kind = kindOf(entry.node);
  const option = new StringSelectMenuOptionBuilder()
   .setLabel(`${'· '.repeat(entry.depth)}${kind ? kindLabel(t, kind) : '?'}`.slice(0, 100))
   .setValue(entry.path)
   .setDefault(entry.path === view.selectedPath);
  if (kind) option.setEmoji(buttonEmoji(view.emotes.get(kindEmotes[kind])));

  const system =
   'custom_id' in entry.node ? this.bindings.systemName(entry.node.custom_id) : null;
  const preview = [nodePreview(t, entry.node), system ? t.bind.bound({ system }) : '']
   .filter(Boolean)
   .join(' · ');
  if (preview) option.setDescription(preview.slice(0, 100));
  return option;
 });

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.Node, page))
  .setPlaceholder(t.builder.nodePlaceholder())
  .setMinValues(0)
  .setMaxValues(1);

 const pageOption = (label: string, nav: NodePageNav) =>
  new StringSelectMenuOptionBuilder().setLabel(label).setValue(nav);
 const paged = [
  ...(page > 0 ? [pageOption(t.builder.previousPage(), NodePageNav.Previous)] : []),
  ...options,
  ...(page < lastNodePage(entries.length)
   ? [pageOption(t.builder.nextPage(), NodePageNav.Next)]
   : []),
 ];

 if (paged.length) {
  select.addOptions(paged);
 } else {
  select
   .setDisabled(true)
   .addOptions(new StringSelectMenuOptionBuilder().setLabel('-').setValue('-'));
 }

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const actionButton = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 action: NodeAction,
) {
 const node = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 const state = node ? toggleState(node, action) : null;
 const stateEmote = state ? EmoteName.Enabled : EmoteName.Disabled;
 const stateStyle = state ? ButtonStyle.Success : ButtonStyle.Secondary;
 const emote = state === null ? actionEmotes[action] : stateEmote;

 const button = new ButtonBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.Action, action, view.selectedPath ?? ''))
  .setLabel(actionLabel(t, action).slice(0, 80))
  .setStyle(state === null ? (actionStyles[action] ?? ButtonStyle.Secondary) : stateStyle)
  .setDisabled(isActionDisabled(view.tree, view.selectedPath, action));
 if (emote) button.setEmoji(buttonEmoji(view.emotes.get(emote)));
 return button;
};

const actionButtonRows = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 return actionRowsFor(view.tree, view.selectedPath).map((actions) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   actions.map((action) => actionButton.call(this, t, view, action)),
  ),
 );
};

const backButton = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 selectedPath: string | null,
) {
 return new ButtonBuilder()
  .setStyle(ButtonStyle.Secondary)
  .setCustomId(this.getRoute(ComponentBuilderRoute.Back, selectedPath ?? '', view.nodePage))
  .setLabel(t.base.t.Back())
  .setEmoji(buttonEmoji(view.emotes.back));
};

const addSelectRow = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 target: AddTarget,
) {
 const placement = resolvePlacement(view.tree, target);
 const actions = placement ? affordableActions(view.tree, placement) : [];

 const select = new StringSelectMenuBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.AddPick, ...addTargetArgs(target)))
  .setPlaceholder(t.add.placeholder())
  .setMinValues(1)
  .setMaxValues(1);

 if (actions.length) {
  select.addOptions(
   actions.map((action) => {
    const option = new StringSelectMenuOptionBuilder()
     .setLabel(actionLabel(t, action).slice(0, 100))
     .setValue(action);
    const kind = addedKinds[action];
    if (kind) option.setEmoji(buttonEmoji(view.emotes.get(kindEmotes[kind])));
    return option;
   }),
  );
 } else {
  select
   .setDisabled(true)
   .addOptions(new StringSelectMenuOptionBuilder().setLabel('-').setValue('-'));
 }

 return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
};

const addPositionRow = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 target: AddTarget,
) {
 const positions = positionsFor(view.tree, target.selectedPath).map((position) =>
  new ButtonBuilder()
   .setStyle(position === target.position ? ButtonStyle.Primary : ButtonStyle.Secondary)
   .setCustomId(
    this.getRoute(ComponentBuilderRoute.AddAt, ...addTargetArgs({ ...target, position })),
   )
   .setLabel(positionLabel(t, position))
   .setDisabled(!resolvePlacement(view.tree, { ...target, position })),
 );

 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  ...positions,
  backButton.call(this, t, view, target.selectedPath),
 );
};

export const addRows = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 target: AddTarget,
): APIMessageTopLevelComponent[] {
 return [
  new TextDisplayBuilder().setContent(
   `${textEmote(view.emotes.plus)} ${targetLine(t, view, target)}`,
  ),
  addSelectRow.call(this, t, view, target),
  addPositionRow.call(this, t, view, target),
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

export const styleRows = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 path: string,
): APIMessageTopLevelComponent[] {
 const node = getNode(view.tree, path);
 const current = node?.type === ComponentType.Button ? node.style : null;

 const styles = styleOptions.map(({ action, style }) => {
  const button = new ButtonBuilder()
   .setStyle(style === ButtonStyle.Link ? ButtonStyle.Secondary : style)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Action, action, path))
   .setLabel(actionLabel(t, action).slice(0, 80))
   .setDisabled(style === current);
  const emote = actionEmotes[action];
  if (emote) button.setEmoji(buttonEmoji(view.emotes.get(emote)));
  return button;
 });

 return [
  new ActionRowBuilder<ButtonBuilder>().addComponents(styles),
  new ActionRowBuilder<ButtonBuilder>().addComponents(backButton.call(this, t, view, path)),
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};

const utilityRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Empty))
   .setLabel(t.base.t.Empty())
   .setEmoji(buttonEmoji(view.emotes.trash)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.ImportJson))
   .setLabel(t.base.t.Import())
   .setEmoji(buttonEmoji(view.emotes.json)),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.ExportJson))
   .setLabel(t.base.t.Export())
   .setEmoji(buttonEmoji(view.emotes.json)),
  new ButtonBuilder()
   .setStyle(view.placeholderStyle)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Placeholders))
   .setLabel(t.base.placeholders.button())
   .setEmoji(buttonEmoji(view.emotes.info)),
 );
};

const actionRow = function (this: ComponentBuilderPlugin, t: Translator, view: BuilderView) {
 const locked = !view.canManage || !isSendable(view.tree, this.bindings.claims);

 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Save))
   .setLabel(t.base.t.Save())
   .setEmoji(buttonEmoji(view.emotes.save))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Send))
   .setLabel(t.base.t.Send())
   .setEmoji(buttonEmoji(view.emotes.send))
   .setDisabled(locked),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Primary)
   .setCustomId(this.getRoute(ComponentBuilderRoute.EditMessage))
   .setLabel(t.builder.editMessage())
   .setEmoji(buttonEmoji(view.emotes.edit))
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
  ...actionButtonRows.call(this, t, view),
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
   this.getRoute(webhook ? ComponentBuilderRoute.WebhookSendTo : ComponentBuilderRoute.SendTo),
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
  backButton.call(this, t, view, null),
 );

 if (mode === SendMode.Bot) {
  buttons.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setCustomId(this.getRoute(ComponentBuilderRoute.WebhookModal))
    .setLabel(t.send.asWebhook())
    .setEmoji(buttonEmoji(view.emotes.webhook)),
  );
 }

 return [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select), buttons].map(
  (row) => row.toJSON() as unknown as APIMessageTopLevelComponent,
 );
};

const headerText = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 browsing: boolean,
) {
 const { emotes } = view;
 const lines = [
  `# ${textEmote(emotes.json)} ${t.builder.title()} · <@${view.marker.execId}>`,
  t.builder.desc(),
 ];

 const selected = browsing && view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 if (selected && kindOf(selected) === NodeKind.Text) {
  lines.push(`${textEmote(emotes.timer)} ${t.builder.waitingForText()}`);
 }

 const validationError = view.tree.length ? validateTree(view.tree, this.bindings.claims) : null;
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
 return new MessagePayload(this.client, { origin: this.name, reason: 'Component builder surface' })
  .setAllowedMentionsUsers([view.marker.execId])
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([
   new SectionBuilder()
    .addTextDisplayComponents(headerText.call(this, t, view, !rows))
    .setButtonAccessory(markerLinkButton(view))
    .toJSON() as unknown as APIMessageTopLevelComponent,
   ...(rows ?? builderRows.call(this, t, view)),
  ]);
};

export const renderDesign = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 tree: WipTree,
): MessagePayload {
 return new MessagePayload(this.client, { origin: this.name, reason: 'Component builder design' })
  .setAllowedMentionsParse([])
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents(
   tree.length
    ? tree
    : [{ ...makeText(t.builder.placeholder()), id: ChromeComponentId.Placeholder }],
  );
};
