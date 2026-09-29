import {
 ActionRowBuilder,
 LabelBuilder,
 ModalBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import { TextInputStyle } from 'discord-api-types/v10';

import { ConfessionsRoute, MenuAction, durationField, reasonField } from '../Classes/Routes.js';

import type { ConfessionsTranslator } from './container.js';

type RouteFn = (name: string, ...args: string[]) => string;

const reasonLimit = 1000;

const reasonInput = (required: boolean): TextInputBuilder =>
 new TextInputBuilder()
  .setCustomId(reasonField)
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(required)
  .setMaxLength(reasonLimit);

export const banForm = (
 t: ConfessionsTranslator,
 route: RouteFn,
 confessionId: string,
): ModalBuilder =>
 new ModalBuilder()
  .setCustomId(route(ConfessionsRoute.BanModal, confessionId))
  .setTitle(t.forms.banTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.forms.banReason())
    .setTextInputComponent(reasonInput(false)),
   new LabelBuilder()
    .setLabel(t.forms.banDuration())
    .setDescription(t.forms.banDurationHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(durationField)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100)
      .setPlaceholder(t.forms.banDurationPlaceholder()),
    ),
  );

export const reportForm = (
 t: ConfessionsTranslator,
 route: RouteFn,
 confessionId: string,
 reply: boolean,
): ModalBuilder =>
 new ModalBuilder()
  .setCustomId(route(ConfessionsRoute.ReportModal, confessionId))
  .setTitle(reply ? t.forms.reportReplyTitle() : t.forms.reportTitle())
  .addLabelComponents(
   new LabelBuilder().setLabel(t.forms.reportReason()).setTextInputComponent(reasonInput(true)),
  );

export const deleteForm = (
 t: ConfessionsTranslator,
 route: RouteFn,
 confessionId: string,
 reply: boolean,
): ModalBuilder =>
 new ModalBuilder()
  .setCustomId(route(ConfessionsRoute.DeleteModal, confessionId))
  .setTitle(reply ? t.forms.deleteReplyTitle() : t.forms.deleteTitle())
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(t.forms.deleteBody()));

export const actionPicker = (
 t: ConfessionsTranslator,
 route: RouteFn,
 confessionId: string,
): ActionRowBuilder<StringSelectMenuBuilder> =>
 new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
   .setCustomId(route(ConfessionsRoute.MenuAction, confessionId))
   .setPlaceholder(t.forms.pickerPlaceholder())
   .addOptions(
    new StringSelectMenuOptionBuilder()
     .setLabel(t.forms.pickBan())
     .setDescription(t.forms.pickBanHint())
     .setValue(MenuAction.Ban),
    new StringSelectMenuOptionBuilder()
     .setLabel(t.forms.pickReport())
     .setDescription(t.forms.pickReportHint())
     .setValue(MenuAction.Report),
   ),
 );
