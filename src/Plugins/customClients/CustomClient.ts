import { API, type RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';

import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';
import { checkToken } from '../../Util/botInGuild.js';

import CustomClientsPlugin from './Plugin.js';

export default class CustomClient extends DBEntry<'customClient'> {
 apiCache: Map<string, API> = new Map();
 plugin: CustomClientsPlugin;

 constructor(client: Client, guildId: string) {
  super(client, 'customClient', { where: { guildId } });

  this.plugin = client.plugins.find((p) => p instanceof CustomClientsPlugin) as CustomClientsPlugin;
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

 createBaseAPI = (guildId: string) => {
  const api = new API(
   (this.client.isDev ? process.env.DevToken : process.env.Token)!.replace('Bot ', ''),
   this.plugin.logger,
   this.client.cache,
   guildId,
  );

  this.registerErrorHandler(api);

  this.apiCache.set(guildId, api);
  return api;
 };

 getCustomAPIforGuildId = async (guildId: string): Promise<API | null> => {
  const cached = this.apiCache.get(guildId);
  if (cached) return cached;

  const base = new CustomClient(this.client, guildId);
  const entry = await base.get();
  if (!entry || !entry.token) return null;

  const api = new API(entry.token, this.plugin.logger, this.client.cache, guildId);
  const status = await checkToken(api, guildId);

  if (status === 'ok') {
   this.apiCache.set(guildId, api);
   return api;
  }

  if (status === 'invalid') {
   this.apiCache.delete(guildId);
   await this.db.client.customClient.update({
    where: { guildId },
    data: { token: null },
   });
  }

  return null;
 };

 getAPIforGuildId = async (guildId: string) =>
  (await this.getCustomAPIforGuildId(guildId)) ?? this.createBaseAPI(guildId);

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
  // TODO: implement error debug channel
  api.on('error', async (message: RequestHandlerError<RequestHandlerErrorType>) => {
   const guildIds = await this.getGuildIdFromError(api, message);
   if (!guildIds) {
    this.plugin.logger.error('Received 401 error from API but could not determine guild ID.');
    return;
   }

   if (message.error?.message.includes('401')) {
    guildIds.forEach((guildId) => this.validateAPI(guildId));
   }

   this.plugin.logger.error(`API error for bot ${api.botId}`);
   this.plugin.logger.debug(message);
  });
 };

 getGuildIdFromError = async (api: API, message: RequestHandlerError<RequestHandlerErrorType>) => {
  const guildId =
   'guildId' in message.options && message.options.guildId
    ? message.options.guildId
    : await this.getGuildIdFromAPI(api);

  if (!guildId) {
   this.plugin.logger.error(
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
