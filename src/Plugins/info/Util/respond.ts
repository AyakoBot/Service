import type { ContainerBuilder } from '@discordjs/builders';
import {
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { getBooleanOption } from '../../../Util/interactionOptions.js';
import { InfoOption } from '../Classes/Commands.js';
import type InfoPlugin from '../Plugin.js';

export type Translator = Awaited<ReturnType<InfoPlugin['t']>>;

export const getHide = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 fallback: boolean = true,
): boolean => getBooleanOption(sub, InfoOption.Hide, fallback);

export enum RespondVia {
 Reply = 'reply',
 Update = 'update',
}

export const respond = function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction,
 containers: ContainerBuilder[],
 hide: boolean,
 via: RespondVia = RespondVia.Reply,
) {
 const payload = new MessagePayload(this.client, { origin: this.name, reason: 'Info panel' })
  .setAllowedMentionsUsers([])
  .setAllowedMentionsRoles([])
  .setComponents(containers.map((container) => container.toJSON()))
  .setFlags(MessageFlags.IsComponentsV2 | (hide ? MessageFlags.Ephemeral : 0));

 return via === RespondVia.Update ? payload.update(cmd) : payload.reply(cmd);
};

export const respondError = function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction,
 content: string,
) {
 return new MessagePayload(this.client, { origin: this.name, reason: 'Info panel error' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
