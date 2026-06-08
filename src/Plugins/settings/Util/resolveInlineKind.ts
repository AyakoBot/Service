import { EditorType } from '../EditorType.js';
import type { SettingsField } from '../SettingsSchema.js';

export enum InlineKind {
 Toggle = 'toggle',
 Select = 'select',
 Entity = 'entity',
 ModalText = 'modaltext',
}

const entity = new Set<EditorType>([
 EditorType.Channel,
 EditorType.Channels,
 EditorType.Category,
 EditorType.Role,
 EditorType.Roles,
 EditorType.User,
 EditorType.Users,
 EditorType.Mention,
 EditorType.Mentions,
]);

export const resolveInlineKind = (field: SettingsField): InlineKind => {
 if (field.editor === EditorType.Boolean) return InlineKind.Toggle;
 if (entity.has(field.editor)) return InlineKind.Entity;
 if (Array.isArray(field.options) && field.options.length > 0) return InlineKind.Select;
 return InlineKind.ModalText;
};
