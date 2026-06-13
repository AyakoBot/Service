import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandOptionChoice,
} from 'discord-api-types/v10';

import { EmbedBuilderCommand } from '../../Classes/Commands.js';
import CustomEmbed from '../../CustomEmbed.js';
import type EmbedBuilderPlugin from '../../Plugin.js';

const findFocused = (
 options: APIApplicationCommandAutocompleteInteraction['data']['options'],
): string => {
 for (const option of options ?? []) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
   const nested = option.options?.find(
    (o) => o.type === ApplicationCommandOptionType.String && o.focused,
   );
   if (nested && nested.type === ApplicationCommandOptionType.String) return nested.value;
  }
  if (option.type === ApplicationCommandOptionType.String && option.focused) return option.value;
 }
 return '';
};

export default async function (
 this: EmbedBuilderPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 if (!cmd.guild_id || cmd.data.name !== EmbedBuilderCommand.EmbedBuilder) return;

 const query = findFocused(cmd.data.options).toLowerCase();
 const saved = await CustomEmbed.all(this.client, cmd.guild_id);

 const choices: APIApplicationCommandOptionChoice[] = saved
  .filter((row) => row.name && (!query || row.name.toLowerCase().includes(query)))
  .slice(0, 25)
  .map((row) => ({ name: row.name.slice(0, 100), value: row.name.slice(0, 100) }));

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createAutocompleteResponse(
  cmd.id,
  cmd.token,
  { choices },
  { origin: this.name, reason: 'Saved embed name autocomplete' },
 );
}
