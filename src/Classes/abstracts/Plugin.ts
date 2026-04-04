import { logger } from '@ayako/utility';
import {
 SlashCommandStringOption,
 type SlashCommandOptionsOnlyBuilder,
 type SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import type { GatewayDispatchEvents } from '@discordjs/core';
import merge from 'lodash.merge';

import baseLang from '../../Languages/en-GB.json' with { type: 'json' };
import type { GatewayEventHandlers, GatewayEventPayloadMap } from '../../Types/gateway.js';
import createTranslator, { type TranslatorType } from '../../Util/translator.js';
import type Client from '../Client.js';

export type BaseLang = TranslatorType<typeof baseLang>;

/**
 * Categories for settings commands.
 * Plugins can assign their settings commands to one of these categories
 * for better organization in the UI.
 */
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
 abstract settingName: string;
 abstract tableName: string;
 private enabled: boolean = true;
 abstract eventHandlers: GatewayEventHandlers<E>;
 abstract languageFiles: LanguageFiles<L>;

 constructor(client: Client) {
  this.client = client;
 }

 registerEvents() {
  logger.debug(`[${this.name}] Registering event handlers...`);
  const events = Object.keys(this.eventHandlers) as E[];

  logger.debug(`[Plugin:${this.name}] Registering ${events.length} event handlers...`);

  events.forEach((event) => {
   logger.debug(`[Plugin:${this.name}] Registering handler for event:`, event);

   this.client.cache.on(event, (data: GatewayEventPayloadMap[E]) => {
    logger.silly(`[Plugin:${this.name}] Event received:`, event);
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
  logger.silly(`[Plugin:${this.name}] Getting language for locale:`, locale);

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
 t = async (
  guildIdOrLocale: string | bigint | null | undefined,
 ): Promise<TranslatorType<L> & { base: BaseLang }> => {
  const lang = await this.getLanguage(guildIdOrLocale);
  return { ...createTranslator(lang), base: createTranslator(baseLang) };
 };

 abstract getCommands(): {
  commands: SlashCommandOptionsOnlyBuilder[];
  settings: { category: SettingsCategory | null; commands: SlashCommandSubcommandBuilder[] }[];
 };
}
