import type { BaseLang, BaseLanguage } from '../../Classes/abstracts/Plugin.js';
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

export interface SettingsField<Row = Record<string, unknown>> {
 column: keyof Row & string;
 editor: EditorType;
 label: string;
 description?: string;
 arity?: FieldArity;
 options?: { label: string; value: string }[] | (() => Promise<{ label: string; value: string }[]>);
 required?: boolean;
 secret?: boolean;
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
}

export interface SettingsGroup<Row = Record<string, unknown>> {
 id: string;
 label: string;
 description?: string;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsField<Row>[];
}

export interface SettingsSchema<Row = Record<string, unknown>> {
 table: TableName;
 rowKey: keyof Row & string;
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
 showIf?: (row: Row) => ShowIfResult;
 validate?: (value: unknown, row: Row) => ShowIfResult;
}

export interface SettingsGroupDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 id: string;
 label: (t: T) => string;
 description?: (t: T) => string;
 showIf?: (row: Row) => ShowIfResult;
 fields: SettingsFieldDef<Row, T>[];
}

export interface SettingsSchemaDef<Row = Record<string, unknown>, T = DefaultTranslator> {
 table: TableName;
 rowKey: keyof Row & string;
 rowLabel: (t: T, row: Row) => string;
 groups: SettingsGroupDef<Row, T>[];
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
