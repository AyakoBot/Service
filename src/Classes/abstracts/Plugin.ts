import { inspect } from 'node:util';

import { API, type RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import { decrypt, ScopedLogger } from '@ayako/utility';
import {
 SlashCommandStringOption,
 type ContextMenuCommandBuilder,
 type SlashCommandOptionsOnlyBuilder,
 type SlashCommandSubcommandBuilder,
 type SlashCommandSubcommandsOnlyBuilder,
} from '@discordjs/builders';
import { GatewayDispatchEvents } from '@discordjs/core';
import type { GatewayGuildDeleteDispatchData } from 'discord-api-types/v10';
import merge from 'lodash.merge';

import baseLang from '../../Languages/en-GB.json' with { type: 'json' };
import type { SettingsSchemaDef } from '../../Plugins/settings/SettingsSchema.js';
import type { GatewayEventHandlers, GatewayEventPayloadMap } from '../../Types/gateway.js';
import { isBotPresent } from '../../Util/botPresence.js';
import { gateToken, TokenGate } from '../../Util/tokenBreaker.js';
import { checkToken } from '../../Util/tokenCheck.js';
import createTranslator, { type TranslatorType } from '../../Util/translator.js';
import type Client from '../Client.js';

export type BaseLang = TranslatorType<typeof baseLang>;

export enum SettingsCategory {
 Utility = 'utility',
 Info = 'info',
 Roles = 'roles',
 Automation = 'automation',
 Moderation = 'moderation',
 Leveling = 'leveling',
 Nitro = 'nitro',
 Fun = 'fun',
 Channels = 'channels',
 Shop = 'shop',
 Vote = 'vote',
}

export enum PluginName {
 Afk = 'afk',
 FilterScraper = '',
 Settings = 'settings',
 CustomClients = 'custom-clients',
 Ticketing = 'ticketing',
 Eval = 'eval',
 EmbedBuilder = 'embed-builder',
 ComponentBuilder = 'component-builder',
 Info = 'info',
 Welcome = 'welcome',
}

export type BaseLanguage = Record<string, unknown>;

export type LanguageFiles<L extends BaseLanguage> = {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 'en-GB': L;
} & Partial<Record<string, L>>;

export const idSelector = new SlashCommandStringOption()
 .setAutocomplete(true)
 .setDescription('The ID of the Setting (Remove if you want to create a Setting)')
 .setRequired(false)
 .setName('id');

export default abstract class Plugin<
 E extends GatewayDispatchEvents = GatewayDispatchEvents,
 L extends BaseLanguage = BaseLanguage,
> {
 client: Client;
 abstract name: string;
 abstract settingName: PluginName;
 dependencies: PluginName[] = [];
 abstract tableName: string;
 abstract customBotPerms: bigint;
 private enabled: boolean = true;
 abstract eventHandlers: GatewayEventHandlers<E>;
 abstract languageFiles: LanguageFiles<L>;
 settingsSchema?: SettingsSchemaDef;
 logger = new ScopedLogger();

 protected pluginBotKey?: string;
 private pluginApiCache: Map<string, API> = new Map();
 private overrideApiCache: Map<string, { cipher: string; api: API }> = new Map();

 invalidateToken?: (cipher: string) => Promise<void>;

 getEmojiSyncTokens?: () => Promise<string[]>;

 onEmojiSyncTokenInvalid?: (token: string) => Promise<void>;

 onGuildRemoved?: (guildId: string) => Promise<void>;

 constructor(client: Client) {
  this.client = client;
 }

 getPluginBotToken = (): string | undefined =>
  (this.pluginBotKey ? process.env[this.pluginBotKey] : undefined);

 invalidateGuildAPI = (guildId: string) => {
  this.overrideApiCache.delete(guildId);
  this.pluginApiCache.delete(guildId);
 };

 getAPI = async (guildId: string, overrideCipher?: string | null): Promise<API> => {
  if (overrideCipher) {
   const cached = this.overrideApiCache.get(guildId);
   if (cached && cached.cipher === overrideCipher) return cached.api;

   let token: string | null = null;
   try {
    token = decrypt(overrideCipher);
   } catch (error) {
    this.nonFatalError(error as Error, `${this.name} getAPI decrypt`);
   }

   if (token) {
    const api = new API(token, this.logger, this.client.cache, guildId);
    const gate = await gateToken(this.client.tokenBreaker, guildId, api.botId, Date.now(), () =>
     checkToken(api, guildId),
    );

    if (gate === TokenGate.Use) {
     this.overrideApiCache.set(guildId, { cipher: overrideCipher, api });
     return api;
    }

    this.overrideApiCache.delete(guildId);
    if (gate === TokenGate.Invalid) {
     this.invalidateGuildAPI(guildId);
     await this.invalidateToken?.(overrideCipher);
    }
   }
  }

  const globalApi = await this.client.getCustomAPI(guildId);
  if (globalApi) return globalApi;

  if (this.pluginBotKey && (await isBotPresent(this.client.cache, guildId, this.pluginBotKey))) {
   let api = this.pluginApiCache.get(guildId);
   if (!api) {
    const token = this.getPluginBotToken();
    if (token) {
     api = new API(token, this.logger, this.client.cache, guildId);
     this.pluginApiCache.set(guildId, api);
    }
   }
   if (api) return api;
  }

  return this.client.getBaseAPI(guildId);
 };

 registerEvents() {
  this.logger.debug(`[${this.name}] Registering event handlers...`);
  const events = Object.keys(this.eventHandlers) as E[];

  this.logger.debug(`[Plugin:${this.name}] Registering ${events.length} event handlers...`);

  events.forEach((event) => {
   this.logger.debug(`[Plugin:${this.name}] Registering handler for event:`, event);

   this.client.cache.on(event, (data: GatewayEventPayloadMap[E]) => {
    this.client.logger.silly(`[Plugin:${this.name}] Event received:`, event);
    this.eventHandlers[event](data);
   });
  });

  if (this.onGuildRemoved) {
   this.client.cache.on(
    GatewayDispatchEvents.GuildDelete,
    (data: GatewayGuildDeleteDispatchData) => {
     if (data.unavailable) return;
     this.onGuildRemoved?.(data.id);
    },
   );
  }
 }

 enable = () => (this.enabled = true);
 disable = () => (this.enabled = false);
 isEnabled = () => this.enabled;

 protected getLanguage = async (
  guildIdOrLocale: string | bigint | null | undefined,
 ): Promise<L> => {
  const locale = await this.client.getLocale(guildIdOrLocale);
  this.logger.silly(`[Plugin:${this.name}] Getting language for locale:`, locale);

  return merge(
   {},
   this.languageFiles['en-GB'],
   this.languageFiles[locale as keyof typeof this.languageFiles],
  ) as L;
 };

 t = async (
  guildIdOrLocale: string | bigint | null | undefined,
 ): Promise<TranslatorType<L> & { base: BaseLang }> => {
  const lang = await this.getLanguage(guildIdOrLocale);
  return { ...createTranslator(lang), base: createTranslator(baseLang) };
 };

 abstract getCommands(): {
  commands: (
   | SlashCommandOptionsOnlyBuilder
   | SlashCommandSubcommandsOnlyBuilder
   | ContextMenuCommandBuilder
  )[];
  settings: { category: SettingsCategory | null; commands: SlashCommandSubcommandBuilder[] }[];
 };

 nonFatalError = (error: Error | RequestHandlerError<RequestHandlerErrorType>, context: string) => {
  this.logger.error(`[Plugin:${this.name}] Non-fatal error in ${context}:`, inspect(error));
 };

 getRoute = (route: string, ...args: { toString(): string }[]): string =>
  [route, ...args.map(String)].join('_');
}
