import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ComponentType,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import { GiveawaysRoute, type PanelOrigin } from '../Classes/Routes.js';
import type GiveawaysPlugin from '../Plugin.js';

import { splitLines } from './prizeModal.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export enum PanelComponentId {
 List = 1,
}

export interface PanelState {
 templateId: string;
 channelId: string;
 origin: PanelOrigin;
 name: string;
 winners: number;
 prizes: string[];
}

export const panelArgs = (state: Pick<PanelState, 'templateId' | 'channelId' | 'origin'>) => [
 state.templateId,
 state.channelId,
 state.origin,
];

export const buildPanel = function (
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 state: PanelState,
): APIMessageTopLevelComponent[] {
 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `### ${constants.formatters.getEmote(emotes.gift)} ${t.panel.title({ name: state.name })}\n${t.panel.progress(
    { count: String(state.prizes.length), winners: String(state.winners) },
   )}`,
  ),
 );

 if (state.prizes.length) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setId(PanelComponentId.List).setContent(state.prizes.join('\n')),
  );
 }

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.getRoute(GiveawaysRoute.PanelEdit, ...panelArgs(state)))
    .setEmoji(buttonEmoji(emotes.edit))
    .setLabel(t.panel.edit()),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Success)
    .setCustomId(this.getRoute(GiveawaysRoute.PanelStart, ...panelArgs(state)))
    .setEmoji(buttonEmoji(emotes.gift))
    .setLabel(t.panel.start())
    .setDisabled(state.prizes.length < state.winners),
  ),
 );

 return [container.toJSON()];
};

type LooseComponent = { type?: number; id?: number; content?: string; components?: unknown[] };

const findList = (components: unknown[]): string | null => {
 for (const raw of components) {
  const component = raw as LooseComponent;
  if (component.type === ComponentType.TextDisplay && component.id === PanelComponentId.List) {
   return component.content ?? '';
  }

  const nested = component.components ? findList(component.components) : null;
  if (nested !== null) return nested;
 }

 return null;
};

export const readPanelPrizes = (components: unknown[] | undefined) =>
 splitLines(findList(components ?? []) ?? '');
