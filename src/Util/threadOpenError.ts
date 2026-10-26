import { DiscordAPIError } from '@discordjs/rest';
import { RESTJSONErrorCodes } from 'discord-api-types/v10';

import type { BaseLang } from '../Classes/abstracts/Plugin.js';

import type { Sentinel } from './sentinel.js';

type ThreadErrorVars = { channel: string; bot: string };
type Explain = (t: BaseLang, vars: ThreadErrorVars) => string;

const explained: Partial<Record<RESTJSONErrorCodes, Explain>> = {
 [RESTJSONErrorCodes.MissingAccess]: (t, vars) => t.errors.threadNoAccess(vars),
 [RESTJSONErrorCodes.MissingPermissions]: (t, vars) => t.errors.threadNoPermission(vars),
 [RESTJSONErrorCodes.CannotExecuteActionOnThisChannelType]: (t) => t.errors.noThreadCanBeCreated(),
};

const threadOpenError = (
 t: BaseLang,
 error: Sentinel,
 channelId: string,
 botId: string,
): string => {
 const vars = { channel: `<#${channelId}>`, bot: `<@${botId}>` };
 const code = error.error instanceof DiscordAPIError ? Number(error.error.code) : null;
 const explain = code === null ? undefined : explained[code as RESTJSONErrorCodes];
 if (explain) return explain(t, vars);

 const detail = error.errorMessage ?? t.errors.unknownError();
 return t.errors.threadFailed({ ...vars, error: code === null ? detail : `${detail} (${code})` });
};

export default threadOpenError;
