import {
 MessageFlags,
 type APIMessageComponentButtonInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIModalSubmitGuildInteraction,
} from 'discord-api-types/v10.js';
import type { SettingNames, SettingsName2TableName } from 'src/Typings/Settings.js';
import type { DataBaseTables, Language } from 'src/Typings/Typings.js';
import { request } from '../requestHandler.js';
import settingsHelpers from '../settingsHelpers.js';
import buttonParsers from './buttonParsers.js';
import componentParsers from './componentParsers.js';
import embedParsers from './embedParsers.js';
import getSettingsFile from './getSettingsFile.js';

export default async <K extends SettingNames>(
 cmd:
  | APIMessageComponentButtonInteraction
  | APIMessageComponentSelectMenuInteraction
  | APIModalSubmitGuildInteraction,
 settingName: K,
 updatedSetting: DataBaseTables[(typeof SettingsName2TableName)[K]],
 language: Language,
) => {
 const settingsFile = await getSettingsFile(settingName, cmd.guild_id!);
 if (!settingsFile) return;

 if (settingsFile.getComponentsV2) {
  request.interactions.updateMessage(cmd.id, cmd.token, {
   components: await settingsFile.getComponentsV2(
    embedParsers,
    buttonParsers,
    componentParsers,
    updatedSetting,
    language,
    language.slashCommands.settings.categories[settingName],
    cmd.guild_id!,
   ),
   files: settingsFile.getFiles ? await settingsFile.getFiles(updatedSetting, language) : undefined,
   flags: MessageFlags.IsComponentsV2,
  });

  return;
 }

 request.interactions.updateMessage(cmd.id, cmd.token, {
  embeds: await settingsFile.getEmbeds(
   embedParsers,
   updatedSetting,
   language,
   language.slashCommands.settings.categories[settingName],
   cmd.guild_id!,
  ),
  components: await settingsFile.getComponents(
   settingsHelpers.buttonParsers,
   updatedSetting,
   language,
   cmd.guild_id!,
  ),
  files: settingsFile.getFiles ? await settingsFile.getFiles(updatedSetting, language) : undefined,
 });
};
