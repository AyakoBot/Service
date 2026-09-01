import type { ChannelType } from '@discordjs/core';

import type Plugin from '../../Classes/abstracts/Plugin.js';
import type { BaseLang, BaseLanguage } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { EmoteName } from '../../Classes/EmoteName.js';
import type { TableName } from '../../Types/prisma.js';
import type { CommandMention } from '../../Util/commandMention.js';
import type { TranslatorType } from '../../Util/translator.js';

import type { EditorType } from './EditorType.js';

export type DefaultTranslator = TranslatorType<BaseLanguage> & { base: BaseLang };

export enum FieldArity {
 Single = 'single',
 Multi = 'multi',
}

export interface ShowIfResult {
 ok: boolean;
 reason?: string;
}

export interface TransformContext {
 client: Client;
 plugin: Plugin;
 guildId: string;
 rowId: string;
}

export type TransformResult = { value: unknown } | { error: string };

export type FieldTransform = (value: unknown, ctx: TransformContext) => Promise<TransformResult>;

export interface RowGuardContext {
 client: Client;
 plugin: Plugin;
 guildId: string;
}

export interface SettingsFieldVirtual<Row = Record<string, unknown>> {
 read: (row: Row, ctx: RowGuardContext) => Promise<unknown>;
 write: (value: unknown, row: Row, ctx: RowGuardContext) => Promise<ShowIfResult>;
}

export type RowGuard<Row = Record<string, unknown>> = (
 row: Row,
 ctx: RowGuardContext,
) => Promise<ShowIfResult>;

export type RowChangeHook = (ctx: TransformContext) => Promise<void>;

export interface SettingsField<Row = Record<string, unknown>> {
 column: keyof Row & string;
 virtual?: SettingsFieldVirtual<Row>;
 editor: EditorType;
 label: string;
 description?: string;
 arity?: FieldArity;
 options?:
  | { label: string; value: string; description?: string }[]
  | (() => Promise<{ label: string; value: string; description?: string }[]>);
 channelTypes?: ChannelType[];
 required?: boolean;
 secret?: boolean;
 multiline?: boolean;
 ms?: boolean;
 headerToggle?: boolean;
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
 transform?: FieldTransform;
}

export interface SettingsGroupAction {
 customId: string;
 label: string;
 description?: string;
 buttonLabel?: string;
 emote?: EmoteName;
}

export interface SettingsGroup<Row = Record<string, unknown>> {
 id: string;
 label: string;
 description?: string;
 emote?: EmoteName;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsField<Row>[];
 actions?: SettingsGroupAction[];
}

export interface SettingsGuideStepAction<Row = Record<string, unknown>> {
 customId: string;
 doneIf: (row: Row, ctx: RowGuardContext) => Promise<boolean> | boolean;
}

export type SettingsGuideStepRequired<Row = Record<string, unknown>> =
 | boolean
 | ((row: Row) => boolean);

export interface SettingsGuideStep<Row = Record<string, unknown>> {
 column?: keyof Row & string;
 action?: SettingsGuideStepAction<Row>;
 label: string;
 description?: string;
 required?: SettingsGuideStepRequired<Row>;
 showIf?: (row: Row) => ShowIfResult;
}

export interface SettingsGuideGate {
 flag: number;
 question: string;
 yes?: string;
 no?: string;
}

export interface SettingsGuideSection<Row = Record<string, unknown>> {
 id: string;
 label: string;
 description?: string;
 emote?: EmoteName;
 showIf?: (row: Row) => ShowIfResult;
 gate?: SettingsGuideGate;
 steps: SettingsGuideStep<Row>[];
}

export interface SettingsGuideAdvert {
 text: string;
 buttonLabel: string;
 emote?: EmoteName;
}

export interface SettingsGuide<Row = Record<string, unknown>> {
 title: string;
 intro?: string;
 advert: SettingsGuideAdvert;
 sections: SettingsGuideSection<Row>[];
}

export interface SettingsSchema<Row = Record<string, unknown>> {
 table: TableName;
 rowKey: keyof Row & string;
 multiRow: boolean;
 title?: string;
 overviewDescription?: string;
 rowLabel: (row: Row) => string;
 rowSummary?: (row: Row) => string;
 groups: SettingsGroup<Row>[];
 guide?: SettingsGuide<Row>;
}

export interface SettingsFieldDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 column: keyof Row & string;
 virtual?: SettingsFieldVirtual<Row>;
 editor: EditorType;
 label: (t: T) => string;
 description?: (t: T) => string;
 arity?: FieldArity;
 options?:
  | { label: (t: T) => string; value: string; description?: (t: T) => string }[]
  | (() => Promise<{ label: string; value: string; description?: string }[]>);
 channelTypes?: ChannelType[];
 required?: boolean;
 secret?: boolean;
 multiline?: boolean;
 ms?: boolean;
 headerToggle?: boolean;
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
 transform?: FieldTransform;
}

export interface SettingsGroupActionDef<T = DefaultTranslator> {
 customId: string;
 label: (t: T) => string;
 description?: (t: T) => string;
 buttonLabel?: (t: T) => string;
 emote?: EmoteName;
}

export interface SettingsGroupDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 id: string;
 label: (t: T) => string;
 description?: (t: T) => string;
 emote?: EmoteName;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsFieldDef<Row, T>[];
 actions?: SettingsGroupActionDef<T>[];
}

export interface SettingsGuideStepDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 column?: keyof Row & string;
 action?: SettingsGuideStepAction<Row>;
 label: (t: T) => string;
 description?: (t: T) => string;
 required?: SettingsGuideStepRequired<Row>;
 showIf?: (row: Row) => ShowIfResult;
}

export interface SettingsGuideGateDef<T = DefaultTranslator> {
 flag: number;
 question: (t: T) => string;
 yes?: (t: T) => string;
 no?: (t: T) => string;
}

export interface SettingsGuideSectionDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 id: string;
 label: (t: T) => string;
 description?: (t: T) => string;
 emote?: EmoteName;
 showIf?: (row: Row) => ShowIfResult;
 gate?: SettingsGuideGateDef<T>;
 steps: SettingsGuideStepDef<Row, T>[];
}

export interface SettingsGuideAdvertDef<T = DefaultTranslator> {
 text: (t: T) => string;
 buttonLabel: (t: T) => string;
 emote?: EmoteName;
}

export interface SettingsGuideDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 title: (t: T) => string;
 intro?: (t: T, mention: CommandMention) => string;
 advert: SettingsGuideAdvertDef<T>;
 sections: SettingsGuideSectionDef<Row, T>[];
}

export interface SettingsSchemaDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 table: TableName;
 rowKey: keyof Row & string;
 multiRow: boolean;
 title?: (t: T) => string;
 overviewDescription?: (t: T) => string;
 rowLabel: (t: T, row: Row) => string;
 rowSummary?: (t: T, row: Row) => string;
 canDelete?: RowGuard<Row>;
 onChange?: RowChangeHook;
 groups: SettingsGroupDef<Row, T>[];
 guide?: SettingsGuideDef<Row, T>;
}

export interface SettingsDelegate {
 findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
 findMany(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
 create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
 updateMany(args: {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
 }): Promise<unknown>;
 deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
}

export interface ResolvedSchema {
 plugin: Plugin;
 schema: SettingsSchemaDef;
}

export const assertSchemaValid = (schema: SettingsSchemaDef): void => {
 schema.groups.forEach((group) => {
  if (group.fields.length > 10) {
   throw new Error(
    `[settings] group '${group.id}' on table '${schema.table}' has ${group.fields.length} fields; max is 10 fields per modal.`,
   );
  }

  group.fields.forEach((field) => {
   if (
    field.virtual &&
    (typeof field.virtual.read !== 'function' || typeof field.virtual.write !== 'function')
   ) {
    throw new Error(
     `[settings] field '${field.column}' in group '${group.id}' on table '${schema.table}' is virtual and must define both 'read' and 'write'.`,
    );
   }
   if (field.virtual && field.required) {
    throw new Error(
     `[settings] field '${field.column}' in group '${group.id}' on table '${schema.table}' is virtual and cannot be required; required-ness is computed from stored row values.`,
    );
   }
  });
 });

 const columns = new Set(schema.groups.flatMap((group) => group.fields.map((f) => f.column)));

 const virtualColumns = new Set(
  schema.groups.flatMap((group) => group.fields.filter((f) => f.virtual).map((f) => f.column)),
 );

 schema.guide?.sections.forEach((section) => {
  section.steps.forEach((step) => {
   if (Boolean(step.column) === Boolean(step.action)) {
    throw new Error(
     `[settings] guide section '${section.id}' on table '${schema.table}' has a step that must define exactly one of 'column' or 'action'.`,
    );
   }
   if (step.column && !columns.has(step.column)) {
    throw new Error(
     `[settings] guide section '${section.id}' on table '${schema.table}' references unknown column '${step.column}'.`,
    );
   }
   if (step.column && virtualColumns.has(step.column)) {
    throw new Error(
     `[settings] guide section '${section.id}' on table '${schema.table}' references virtual column '${step.column}'; virtual fields cannot be guide steps.`,
    );
   }
  });
 });
};
