import { API, type RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';

import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';

export default class CustomClient extends DBEntry<'customClient'> {
 apiCache: Map<string, API> = new Map();
 baseApi: API;

 constructor(client: Client, guildId: string) {
  super(client, 'customClient', { guildId });
  this.baseApi = this.client.getBaseAPI();
 }

 getBotIdForGuildId = async (guildId: string) => {
  const base = new CustomClient(this.client, guildId);
  const data = await base.get();
  if (!data) return this.client.user?.id || '';

  return (
   data.appId ||
   Buffer.from(data.token?.split('.')[0] || '', 'base64').toString() ||
   this.client.user?.id ||
   ''
  );
 };

 getAPIforGuildId = async (guildId: string) => {
  const base = new CustomClient(this.client, guildId);
  const cached = this.apiCache.get(guildId);
  if (cached) return cached;

  const entry = await base.get();
  if (!entry || !entry.token) return this.baseApi;

  const api = new API(entry.token, this.client.logger, this.client.cache, guildId);
  const isValid = await this.validateAPI(guildId, api);
  if (!isValid) return this.client.getBaseAPI();

  this.apiCache.set(guildId, api);
  return api;
 };

 validateAPI = async (guildId: string, api?: API) => {
  const apiToValidate = api || (await this.getAPIforGuildId(guildId));
  const self = await apiToValidate.applications
   .getCurrent({ origin: 'API Initialization', reason: 'Validating API token' })
   .catch(() => null);
  if (self) return true;

  this.invalidateAPI(guildId);
  return false;
 };

 invalidateAPI = async (guildId: string) => {
  const base = new CustomClient(this.client, guildId);
  this.apiCache.delete(guildId);
  await base.update({ token: null });
 };

 registerErrorHandler = (api: API) => {
  api.on('error', async (message: RequestHandlerError<RequestHandlerErrorType>) => {
   const guildIds = await this.getGuildIdFromError(api, message);
   if (!guildIds) {
    this.client.logger.error('Received 401 error from API but could not determine guild ID.');
    return;
   }

   if (message.error?.message.includes('401')) {
    guildIds.forEach((guildId) => this.validateAPI(guildId));
   }

   this.client.logger.error(`API error for bot ${api.botId}`);
   this.client.logger.debug(message);
  });
 };

 getGuildIdFromError = async (api: API, message: RequestHandlerError<RequestHandlerErrorType>) => {
  const guildId =
   'guildId' in message.options && message.options.guildId
    ? message.options.guildId
    : await this.getGuildIdFromAPI(api);

  if (!guildId) {
   this.client.logger.error(
    'Received 401 error from API but could not determine guild ID to invalidate token for.',
   );
   return false;
  }

  return Array.isArray(guildId) ? guildId : [guildId];
 };

 getGuildIdFromAPI = (api: API): string | Promise<string[] | null> | null => {
  const cached = this.getGuildIdFromAPICache(api);
  if (cached) return cached;

  return this.getGuildIdFromDB(api);
 };

 getGuildIdFromAPICache = (api: API): string | null => {
  const cached = Array.from(this.apiCache.entries()).find(
   ([, cachedApi]) => cachedApi.botId === api.botId,
  );
  return cached ? cached[0] : null;
 };

 getGuildIdFromDB = async (api: API): Promise<string[] | null> => {
  const entries = await this.db.client.customClient.findMany({
   where: { appId: api.botId, token: { not: null } },
  });

  return entries.map((entry) => entry.guildId) || null;
 };
}
