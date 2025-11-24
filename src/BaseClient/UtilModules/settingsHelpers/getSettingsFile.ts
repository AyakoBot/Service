import { glob } from 'glob';
import * as CT from '../../../Typings/Typings.js';
import constants from '../../Other/constants.js';
import error from '../error.js';

/**
 * Retrieves the settings file for a given setting name and guild.
 * @param settingName - The name of the setting to retrieve.
 * @param guildId - The ID of the guild to retrieve the setting for.
 * @returns The settings file for the given setting name, or undefined if no file is found.
 */
export default async <T extends keyof typeof CT.SettingsName2TableName>(
 settingName: T,
 guildId: string,
) => {
 const files = await glob(
  `${process.cwd()}${
   process.cwd().includes('dist') ? '' : '/dist'
  }/Commands/SlashCommands/settings/**/*`,
 );

 const file = files.find((f) =>
  f.endsWith(
   `/${
    constants.commands.settings.basicSettings.includes(String(settingName))
     ? `${String(settingName)}/basic`
     : String(settingName)
   }.js`,
  ),
 );
 if (!file) {
  error(guildId, new Error(`No file found for settings ${settingName}`));
  return undefined;
 }

 return (await import(file)) as CT.SettingsFile<T>;
};
