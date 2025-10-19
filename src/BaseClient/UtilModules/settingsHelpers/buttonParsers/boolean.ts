import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';
import constants from '../../../Other/constants.js';
import emotes from '../../emotes.js';
import { getWithUTS } from './back.js';

/**
 * Creates a boolean button component for the settings editor.
 * @param language - The language object containing translations.
 * @param setting - The current value of the setting.
 * @param name - The name of the field.
 * @param settingName - The name of the setting.
 * @param uniquetimestamp - A unique timestamp used to identify the button component.
 * @returns A Discord API button component.
 */
export default <T extends keyof CT.Categories>(
 language: CT.Language,
 setting: boolean | undefined,
 name: keyof CT.FieldName<T>,
 settingName: T,
 uniquetimestamp: number | undefined,
): Discord.APIButtonComponent => {
 const constantTypes =
  constants.commands.settings.types[settingName as keyof typeof constants.commands.settings.types];

 return {
  type: Discord.ComponentType.Button,
  label: (
   (
    language.slashCommands.settings.categories[settingName as CT.SettingNames]
     .fields as CT.FieldName<T>
   )[name] as unknown as Record<'name', string>
  ).name,
  style: setting ? Discord.ButtonStyle.Primary : Discord.ButtonStyle.Danger,
  custom_id: getWithUTS(
   `settings/editors/${constantTypes[name as keyof typeof constantTypes]}_${String(
    name,
   )}_${String(settingName)}`,
   uniquetimestamp,
  ),
  emoji: setting ? emotes.enabled : emotes.disabled,
 };
};
