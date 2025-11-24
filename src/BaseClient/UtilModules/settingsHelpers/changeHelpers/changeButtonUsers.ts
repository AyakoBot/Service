import {
 ButtonStyle,
 ComponentType,
 type APIButtonComponentWithCustomId,
} from 'discord-api-types/v10.js';
import { SettingsName2TableName, type Language } from '../../../../Typings/Typings.js';
import emotes from '../../emotes.js';
import { getWithUTS } from '../buttonParsers/back.js';

export default <T extends keyof typeof SettingsName2TableName>(
 language: Language,
 settingName: T,
 fieldName: string,
 uniquetimestamp: number | string | undefined,
 many: boolean = true,
): APIButtonComponentWithCustomId => ({
 type: ComponentType.Button,
 style: ButtonStyle.Secondary,
 custom_id: getWithUTS(
  `settings/editors/userId${many ? 's' : ''}_${fieldName}_${settingName}`,
  uniquetimestamp,
 ),
 label: language.slashCommands.settings.addById,
 emoji: emotes.MemberBright,
});
