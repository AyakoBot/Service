import type { RequestHandlerError, RequestHandlerErrorType } from '@ayako/api';
import { DiscordAPIError } from '@discordjs/rest';
import type { RESTJSONErrorCodes } from 'discord-api-types/v10';

export type Sentinel = RequestHandlerError<RequestHandlerErrorType>;

export const isRawErrorCode = (error: unknown, code: RESTJSONErrorCodes): boolean =>
 error instanceof DiscordAPIError && error.code === code;

export const isErrorCode = (sentinel: Sentinel, code: RESTJSONErrorCodes): boolean =>
 isRawErrorCode(sentinel.error, code);
