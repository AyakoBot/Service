import { type API, RequestHandlerError } from '@ayako/api';

export enum TokenCheckResult {
 OK = 'ok',
 Invalid = 'invalid',
 NotInGuild = 'notInGuild',
 NoAccess = 'noaccess',
}

export const checkToken = async (api: API, guildId: string): Promise<TokenCheckResult> => {
 const result = await api.guilds.getMember(guildId, api.botId, {
  origin: 'checkToken',
  reason: 'Validating bot token and guild membership',
  silent: true,
 });

 if (!(result instanceof RequestHandlerError)) return TokenCheckResult.OK;

 const err = result.error as { status?: number; code?: number } | null;
 if (err?.status === 401) return TokenCheckResult.Invalid;
 if (err?.code === 10004) return TokenCheckResult.NotInGuild;

 return TokenCheckResult.NoAccess;
};
