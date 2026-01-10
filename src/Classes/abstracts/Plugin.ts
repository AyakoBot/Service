import type {
 SlashCommandOptionsOnlyBuilder,
 SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import type { GatewayDispatchEvents } from '@discordjs/core';
import merge from 'lodash.merge';

import type { GatewayEventHandlers, GatewayEventPayloadMap } from '../../Types/gateway.js';
import createTranslator, { type TranslatorType } from '../../Util/translator.js';
import type Client from '../Client.js';
import { default as Logger, default as logger } from '../Logger.js';

/**
 * Base language structure that all plugins must follow.
 * Plugins can extend this with their own nested structures.
 */
export type BaseLanguage = Record<string, unknown>;

/**
 * Language files mapping locales to language objects.
 * 'en-GB' is required as the base/fallback language.
 */
export type LanguageFiles<L extends BaseLanguage> = {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 'en-GB': L;
} & Partial<Record<string, L>>;

export default abstract class Plugin<
 E extends GatewayDispatchEvents = GatewayDispatchEvents,
 L extends BaseLanguage = BaseLanguage,
> {
 client: Client;
 abstract name: string;
 enabled: boolean = true;
 abstract eventHandlers: GatewayEventHandlers<E>;
 abstract languageFiles: LanguageFiles<L>;

 constructor(client: Client) {
  this.client = client;

  const pluginName = new Error().stack?.split(/at/g)[2]?.trim().split(/\s/g)[1];

  queueMicrotask(() => {
   logger.debug(`[${pluginName}] Registering event handlers...`);

   this.registerEvents();
  });
 }

 private registerEvents() {
  const events = Object.keys(this.eventHandlers) as E[];

  logger.debug(`[Plugin:${this.name}] Registering ${events.length} event handlers...`);

  events.forEach((event) => {
   logger.debug(`[Plugin:${this.name}] Registering handler for event:`, event);

   this.client.cache.on(event, (data: GatewayEventPayloadMap[E]) => {
    this.eventHandlers[event](data);
   });
  });
 }

 enable = () => (this.enabled = true);
 disable = () => (this.enabled = false);
 isEnabled = () => this.enabled;

 /**
  * Gets the merged language object for a given guild or locale.
  * Falls back to 'en-GB' for missing translations.
  *
  * @param guildIdOrLocale - Guild ID (bigint/string) or locale string (e.g., 'en-GB')
  * @returns The merged language object
  */
 protected getLanguage = async (
  guildIdOrLocale: string | bigint | null | undefined,
 ): Promise<L> => {
  const locale = await this.client.getLocale(guildIdOrLocale);
  Logger.silly(`[Plugin:${this.name}] Getting language for locale:`, locale);

  return merge(
   {},
   this.languageFiles['en-GB'],
   this.languageFiles[locale as keyof typeof this.languageFiles],
  ) as L;
 };

 /**
  * Gets a typed translator for the given guild or locale.
  * Returns a proxy that converts string templates into callable functions.
  *
  * @example
  * const t = await plugin.t(guildId);
  * t.messages.welcome({ user: { username: 'Lolo' } });
  *
  * @param guildIdOrLocale - Guild ID (bigint/string) or locale string
  * @returns A typed translator proxy
  */
 t = async (guildIdOrLocale: string | bigint | null | undefined): Promise<TranslatorType<L>> => {
  const lang = await this.getLanguage(guildIdOrLocale);
  return createTranslator(lang);
 };

 abstract getCommands(): {
  commands: SlashCommandOptionsOnlyBuilder[];
  settings: { category: string | null; commands: SlashCommandSubcommandBuilder[] }[];
 };
}
