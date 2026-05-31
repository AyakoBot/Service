import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';

import type { BaseLang } from '../Classes/abstracts/Plugin.js';
import type Client from '../Classes/Client.js';

import getErrorMessagePayload from './getErrorMessagePayload.js';

export default async function (
 this: Client,
 error: string,
 cmd: APIInteraction,
 t: BaseLang,
 ephemeral: boolean = true,
) {
 this.logger.error(`Error executing command: ${error}`);

 getErrorMessagePayload
  .call(this, t, error, {
   origin: 'ShowCommandError',
   reason: 'Showing the executing user an error',
  })
  .setFlags(MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0))
  .reply(cmd);
}
