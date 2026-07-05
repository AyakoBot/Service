import { type API, RequestHandlerError } from '@ayako/api';

export enum TokenCheckResult {
 OK = 'ok',
 Invalid = 'invalid',
 NoAccess = 'noaccess',
}

export const checkToken = async (api: API, guildId: string): Promise<TokenCheckResult> => {
 const result = await api.guilds.getMember(guildId, api.botId, {
  origin: 'checkToken',
  reason: 'Validating bot token and guild membership',
 });

 if (!(result instanceof RequestHandlerError)) return TokenCheckResult.OK;

 const status = (result.error as { status?: number } | null)?.status;
 if (status === 401) return TokenCheckResult.Invalid;

 return TokenCheckResult.NoAccess;
};
