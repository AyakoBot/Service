import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';
import emotes from '../../emotes.js';
import { getWithUTS } from './back.js';

/**
 * Creates a button component for deleting a setting.
 * @param language - The language object containing translations.
 * @param name - The name of the setting.
 * @param uniquetimestamp - A unique timestamp used to identify the button component.
 * @returns A Discord API button component.
 */
export default <T extends keyof typeof CT.SettingsName2TableName>(
 language: CT.Language,
 name: T,
 uniquetimestamp: number | undefined,
): Discord.APIButtonComponent => ({
 type: Discord.ComponentType.Button,
 label: language.slashCommands.settings.delete,
 style: Discord.ButtonStyle.Danger,
 custom_id: getWithUTS(`settings/delete_${String(name)}`, uniquetimestamp),
 emoji: emotes.minusBG,
});
