import type { TableName } from '../../Types/prisma.js';

import type { EditorType } from './EditorType.js';

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

export const assertSchemaValid = (schema: SettingsSchema): void => {
 schema.groups.forEach((group) => {
  if (group.fields.length > 5) {
   throw new Error(
    `[settings] group '${group.id}' on table '${schema.table}' has ${group.fields.length} fields; max is 5 fields per modal.`,
   );
  }
 });
};
