import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';
import emotes from '../../emotes.js';

export default <T extends keyof typeof CT.SettingsName2TableName>(
 name: T,
 fieldName: string,
): Discord.APIButtonComponent => ({
 type: Discord.ComponentType.Button,
 style: Discord.ButtonStyle.Danger,
 custom_id: `settings/modal_${String(name)}_${fieldName}`,
 emoji: emotes.back,
});
