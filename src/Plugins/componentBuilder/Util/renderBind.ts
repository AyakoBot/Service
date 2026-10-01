import {
 ActionRowBuilder,
 ButtonBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, type APIMessageTopLevelComponent } from 'discord-api-types/v10';

import type { SettingsOption } from '../../settings/SettingsSchema.js';
import { buttonEmoji, textEmote } from '../../settings/Util/settingsEmotes.js';
import { ComponentBuilderRoute } from '../Classes/Routes.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import type { BuilderView } from './builderContext.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

export interface BindStep {
 prompt: string;
 customId: string;
 options: SettingsOption[];
 back?: string;
}

const optionTextLimit = 100;
const placeholderLimit = 150;

const stepSelect = (step: BindStep) =>
 new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
   .setCustomId(step.customId)
   .setPlaceholder(step.prompt.slice(0, placeholderLimit))
   .setMinValues(1)
   .setMaxValues(1)
   .addOptions(
    step.options.map((option) => {
     const built = new StringSelectMenuOptionBuilder()
      .setLabel(option.label.slice(0, optionTextLimit))
      .setValue(option.value);
     return option.description
      ? built.setDescription(option.description.slice(0, optionTextLimit))
      : built;
    }),
   ),
 );

const stepButtons = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 step: BindStep,
) {
 const row = new ActionRowBuilder<ButtonBuilder>();
 if (step.back) {
  row.addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(step.back)
    .setLabel(t.base.t.Back())
    .setEmoji(buttonEmoji(view.emotes.back)),
  );
 }

 return row.addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Danger)
   .setCustomId(this.getRoute(ComponentBuilderRoute.Back, view.selectedPath ?? '', view.nodePage))
   .setLabel(t.bind.discard())
   .setEmoji(buttonEmoji(view.emotes.trash)),
 );
};

export const bindRows = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 step: BindStep,
): APIMessageTopLevelComponent[] {
 const text = step.options.length ? step.prompt : t.bind.empty();

 return [
  new TextDisplayBuilder().setContent(`${textEmote(view.emotes.plus)} ${text}`),
  ...(step.options.length ? [stepSelect(step)] : []),
  stepButtons.call(this, t, view, step),
 ].map((row) => row.toJSON() as unknown as APIMessageTopLevelComponent);
};
