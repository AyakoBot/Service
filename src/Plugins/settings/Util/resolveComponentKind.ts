import { EditorType } from '../EditorType.js';
import { FieldArity } from '../SettingsSchema.js';

export enum ComponentKind {
 CheckboxBool = 'checkbox-bool',
 Entity = 'entity',
 Text = 'text',
 TextMulti = 'text-multi',
 SecretText = 'secret-text',
 Radio = 'radio',
 CheckboxGroup = 'checkbox-group',
 Select1 = 'select-1',
 SelectN = 'select-n',
}

const ENTITY = new Set<EditorType>([
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

const TEXT_SINGLE = new Set<EditorType>([
 EditorType.String,
 EditorType.Number,
 EditorType.Duration,
]);

const SECRET = new Set<EditorType>([EditorType.Token, EditorType.BotToken]);

export const resolveComponentKind = (
 editor: EditorType,
 arity: FieldArity,
 optionCount: number,
): ComponentKind => {
 if (editor === EditorType.Boolean) return ComponentKind.CheckboxBool;
 if (SECRET.has(editor)) return ComponentKind.SecretText;
 if (ENTITY.has(editor)) return ComponentKind.Entity;
 if (editor === EditorType.Strings) return ComponentKind.TextMulti;
 if (TEXT_SINGLE.has(editor)) return ComponentKind.Text;

 if (arity === FieldArity.Multi) {
  return optionCount <= 5 ? ComponentKind.CheckboxGroup : ComponentKind.SelectN;
 }
 return optionCount <= 5 ? ComponentKind.Radio : ComponentKind.Select1;
};
