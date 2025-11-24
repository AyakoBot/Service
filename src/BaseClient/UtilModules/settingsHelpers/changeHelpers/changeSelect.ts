import { ComponentType, type APIStringSelectComponent } from 'discord-api-types/v10.js';
import * as CT from '../../../../Typings/Typings.js';
import { getWithUTS } from '../buttonParsers/back.js';

export default <T extends keyof typeof CT.SettingsName2TableName>(
 fieldName: string,
 settingName: T,
 type: CT.EditorTypes,
 options: {
  options: APIStringSelectComponent['options'];
  placeholder?: string;
  max_values?: number;
  min_values?: number;
  disabled?: boolean;
 },
 uniquetimestamp: number | undefined,
) => {
 const menu: APIStringSelectComponent = {
  min_values: options.min_values || 1,
  max_values: options.max_values || 1,
  custom_id: getWithUTS(`settings/${type}_${fieldName}_${String(settingName)}`, uniquetimestamp),
  type: ComponentType.StringSelect,
  options: (options.options.length ? options.options : [{ label: '-', value: '-' }]) ?? [
   { label: '-', value: '-' },
  ],
  placeholder: options.placeholder,
  disabled: options.disabled || !options.options.length,
 };

 return menu;
};
