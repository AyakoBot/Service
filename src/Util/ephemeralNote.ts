import {
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../Classes/abstracts/MessagePayload.js';
import type Client from '../Classes/Client.js';

export default function (
 this: { client: Client; name: string },
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: `${this.name} note` })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
}
