import type { RequestHandlerError, RequestHandlerErrorType } from '@ayako/api';
import type {
 APIApplicationCommandInteraction,
 APIMessageComponentInteraction,
 APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import type Plugin from '../Classes/abstracts/Plugin.js';

import ephemeralNote from './ephemeralNote.js';

export default function (
 this: Pick<Plugin, 'client' | 'name'>,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
 error: RequestHandlerError<RequestHandlerErrorType>,
 fallback: string,
) {
 ephemeralNote.call(this, cmd, error.errorMessage ?? fallback);
}
