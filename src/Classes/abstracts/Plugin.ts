import { inspect } from 'node:util';

import type { RequestHandlerError, RequestHandlerErrorType } from '@ayako/api';
import { ScopedLogger } from '@ayako/utility';
import {
 SlashCommandStringOption,
 type SlashCommandOptionsOnlyBuilder,
 type SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import type { APIPartialEmoji, ChannelType, GatewayDispatchEvents } from '@discordjs/core';
import merge from 'lodash.merge';

import baseLang from '../../Languages/en-GB.json' with { type: 'json' };
import { EditorType } from '../../Plugins/settings/EditorType.js';
import type { SettingsSchemaDef } from '../../Plugins/settings/SettingsSchema.js';
import type { GatewayEventHandlers, GatewayEventPayloadMap } from '../../Types/gateway.js';
import createTranslator, { type TranslatorType } from '../../Util/translator.js';
import type Client from '../Client.js';
import emotes from '../Emotes.js';

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
 groupEmotes?: Record<string, APIPartialEmoji>;
 settingsSchema?: SettingsSchemaDef;
 logger = new ScopedLogger();

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 private editorEmotes: Record<EditorType, any> = {
  [EditorType.Channel]: (channelType: ChannelType) =>
   emotes.channelTypes[channelType as keyof typeof emotes.channelTypes] || emotes.channelTypes[0],
  [EditorType.Channels]: (channelType: ChannelType) =>
   this.editorEmotes[EditorType.Channel](channelType),
  [EditorType.Role]: emotes.Role,
  [EditorType.Roles]: emotes.Role,
  [EditorType.User]: emotes.Member,
  [EditorType.Users]: emotes.Member,
  [EditorType.Mention]: undefined,
  [EditorType.Mentions]: undefined,
  [EditorType.Boolean]: (value: boolean) => (value ? emotes.enabled : emotes.disabled),
  [EditorType.Duration]: emotes.timer,
  [EditorType.String]: undefined,
  [EditorType.Language]: undefined,
  [EditorType.Number]: emotes.number,
  [EditorType.Punishment]: emotes.hammer,
  [EditorType.AntiRaidPunishment]: emotes.hammer,
  [EditorType.Embed]: emotes.Message,
  [EditorType.Token]: emotes.lock,
  [EditorType.BotToken]: emotes.lock,
  [EditorType.Message]: emotes.Message,
  [EditorType.ShopType]: emotes.shop,
  [EditorType.FormulaType]: emotes.brain,
  [EditorType.Emote]: emotes.Emoji,
  [EditorType.Emotes]: emotes.Emoji,
  [EditorType.Command]: emotes.Command,
  [EditorType.AutoModRules]: emotes.AutoMod,
  [EditorType.SettingLink]: emotes.settings,
  [EditorType.AutoPunishment]: emotes.hammer,
  [EditorType.LvlUpMode]: undefined,
  [EditorType.Strings]: undefined,
  [EditorType.QuestionType]: emotes.question,
  [EditorType.Category]: emotes.channelTypes[4],
  [EditorType.Voice]: emotes.channelTypes[2],
  [EditorType.Permission]: emotes.settings,
  [EditorType.RoleMode]: emotes.Role,
  [EditorType.Commands]: emotes.Command,
  [EditorType.Questions]: emotes.question,
  [EditorType.Position]: emotes.number,
  [EditorType.ThreadAutoArchiveDuration]: emotes.timer,
  [EditorType.WeekendsType]: emotes.calendar,
  [EditorType.TicketType]: emotes.ticket,
  [EditorType.TicketLogMode]: emotes.log,

  [EditorType.GuildId]: undefined,
  [EditorType.Id]: undefined,
 };

 constructor(client: Client) {
  this.client = client;
 }

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
  this.logger.silly(`[Plugin:${this.name}] Getting language for locale:`, locale);

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
  * t.messages.welcome({ user: { username: 'Ayako' } });
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

 nonFatalError = (error: Error | RequestHandlerError<RequestHandlerErrorType>, context: string) => {
  this.logger.error(`[Plugin:${this.name}] Non-fatal error in ${context}:`, inspect(error));
 };

 getEmoteForGroup(groupId: string): APIPartialEmoji {
  if (!this.groupEmotes || !this.groupEmotes[groupId]) return emotes.settings;
  return this.groupEmotes[groupId];
 }

 getEmoteForEditor<
  K extends EditorType,
  T extends K extends EditorType.Channels | EditorType.Channel
   ? ChannelType
   : K extends EditorType.Boolean
     ? boolean
     : unknown,
 >(editor: K, value: T): APIPartialEmoji {
  if (!this.editorEmotes || !this.editorEmotes[editor]) return emotes.settings;

  const fn = this.editorEmotes[editor];

  if (typeof fn === 'function') return fn(value as never);
  return fn;
 }
}
