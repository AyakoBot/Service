import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

const universalCommands = function (
 this: Client,
): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
 return this.plugins.flatMap((plugin) => plugin.getUniversalCommands?.() ?? []);
};

export default universalCommands;
