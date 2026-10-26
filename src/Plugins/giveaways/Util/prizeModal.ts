import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import { TextInputStyle } from 'discord-api-types/v10';

import { findModalValue } from '../../../Util/findModalValue.js';
import type GiveawaysPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

enum PrizeField {
 Shared = 'shared',
 List = 'list',
}

const sharedLimit = 1024;
const listLimit = 4000;

export interface PrizeForm {
 prize: string;
 values: string[];
}

export const buildPrizeModal = (
 t: Translator,
 customId: string,
 prize: string | null,
 values: string[],
 revealed: number,
) => {
 const shared = new TextInputBuilder()
  .setCustomId(PrizeField.Shared)
  .setStyle(TextInputStyle.Short)
  .setRequired(true)
  .setMaxLength(sharedLimit);
 if (prize) shared.setValue(prize);

 const list = new TextInputBuilder()
  .setCustomId(PrizeField.List)
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false)
  .setMaxLength(listLimit);
 if (values.length) list.setValue(values.join('\n'));

 return new ModalBuilder()
  .setCustomId(customId)
  .setTitle(t.prizes.title())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.prizes.shared())
    .setDescription(t.prizes.sharedHint())
    .setTextInputComponent(shared),
   new LabelBuilder()
    .setLabel(t.prizes.list())
    .setDescription(revealed ? t.prizes.listKept({ count: String(revealed) }) : t.prizes.listHint())
    .setTextInputComponent(list),
  );
};

export const splitLines = (raw: string) =>
 raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length);

export const readPrizeModal = (components: unknown): PrizeForm => ({
 prize: (findModalValue(components, PrizeField.Shared) ?? '').trim(),
 values: splitLines(findModalValue(components, PrizeField.List) ?? ''),
});

export const buildPanelModal = (t: Translator, customId: string, values: string[]) => {
 const list = new TextInputBuilder()
  .setCustomId(PrizeField.List)
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(true)
  .setMaxLength(listLimit);
 if (values.length) list.setValue(values.join('\n'));

 return new ModalBuilder()
  .setCustomId(customId)
  .setTitle(t.prizes.title())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.prizes.list())
    .setDescription(t.panel.listHint())
    .setTextInputComponent(list),
  );
};

export const readPanelModal = (components: unknown) =>
 splitLines(findModalValue(components, PrizeField.List) ?? '');

export const prizeSavedNote = (t: Translator, count: number, winners: number) => {
 if (!count) return t.prizes.savedShared();

 const saved = t.prizes.saved({ count: String(count) });
 return count < winners
  ? `${saved} ${t.prizes.short({ count: String(count), winners: String(winners) })}`
  : saved;
};
