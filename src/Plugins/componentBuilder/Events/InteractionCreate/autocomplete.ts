import {
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandOptionChoice,
} from 'discord-api-types/v10';

import { findFocusedString } from '../../../../Util/interactionOptions.js';
import { ComponentBuilderCommand } from '../../Classes/Commands.js';
import CustomComponents from '../../CustomComponents.js';
import type ComponentBuilderPlugin from '../../Plugin.js';

export default async function (
 this: ComponentBuilderPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 if (!cmd.guild_id || cmd.data.name !== ComponentBuilderCommand.ComponentBuilder) return;

 const query = findFocusedString(cmd.data.options).toLowerCase();
 const saved = await CustomComponents.all(this.client, cmd.guild_id);

 const choices: APIApplicationCommandOptionChoice[] = saved
  .filter((row) => row.name && (!query || row.name.toLowerCase().includes(query)))
  .slice(0, 25)
  .map((row) => ({ name: row.name.slice(0, 100), value: row.name.slice(0, 100) }));

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createAutocompleteResponse(
  cmd.id,
  cmd.token,
  { choices },
  { origin: this.name, reason: 'Saved components name autocomplete' },
 );
}
