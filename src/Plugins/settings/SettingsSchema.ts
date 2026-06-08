import type { APIPartialEmoji } from '@discordjs/core';

import type Plugin from '../../Classes/abstracts/Plugin.js';
import type { BaseLang, BaseLanguage } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { TableName } from '../../Types/prisma.js';
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

export type RowGuard<Row = Record<string, unknown>> = (
 row: Row,
 ctx: RowGuardContext,
) => Promise<ShowIfResult>;

export interface SettingsField<Row = Record<string, unknown>> {
 column: keyof Row & string;
 editor: EditorType;
 label: string;
 description?: string;
 arity?: FieldArity;
 options?: { label: string; value: string }[] | (() => Promise<{ label: string; value: string }[]>);
 required?: boolean;
 secret?: boolean;
 headerToggle?: boolean;
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
 transform?: FieldTransform;
}

export interface SettingsGroup<Row = Record<string, unknown>> {
 id: string;
 label: string;
 description?: string;
 emote?: APIPartialEmoji;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsField<Row>[];
}

export interface SettingsSchema<Row = Record<string, unknown>> {
 table: TableName;
 rowKey: keyof Row & string;
 multiRow: boolean;
 title?: string;
 rowLabel: (row: Row) => string;
 groups: SettingsGroup<Row>[];
}

export interface SettingsFieldDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 column: keyof Row & string;
 editor: EditorType;
 label: (t: T) => string;
 description?: (t: T) => string;
 arity?: FieldArity;
 options?:
  | { label: (t: T) => string; value: string }[]
  | (() => Promise<{ label: string; value: string }[]>);
 required?: boolean;
 secret?: boolean;
 headerToggle?: boolean;
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
 transform?: FieldTransform;
}

export interface SettingsGroupDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 id: string;
 label: (t: T) => string;
 description?: (t: T) => string;
 emote?: APIPartialEmoji;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsFieldDef<Row, T>[];
}

export interface SettingsSchemaDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 table: TableName;
 rowKey: keyof Row & string;
 multiRow: boolean;
 title?: (t: T) => string;
 rowLabel: (t: T, row: Row) => string;
 canDelete?: RowGuard<Row>;
 groups: SettingsGroupDef<Row, T>[];
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
  if (group.fields.length > 5) {
   throw new Error(
    `[settings] group '${group.id}' on table '${schema.table}' has ${group.fields.length} fields; max is 5 fields per modal.`,
   );
  }
 });
};
