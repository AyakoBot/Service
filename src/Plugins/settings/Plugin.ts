import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class SettingsPlugin extends Plugin<Events, APILanguage> {
 name = 'Settings';
 settingName = '';
 tableName = '';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {} as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [],
  settings: [],
 });
}

export enum EditorType {
 Channel = 'channel',
 Channels = 'channels',
 Role = 'role',
 Roles = 'roles',
 User = 'user',
 Users = 'users',
 Mention = 'mention',
 Mentions = 'mentions',

 Boolean = 'boolean',
 Duration = 'duration',
 String = 'string',
 Language = 'language',
 Number = 'number',
 Punishment = 'punishment',
 AntiRaidPunishment = 'antiraid-punishment',
 Embed = 'embed',
 Token = 'token',
 BotToken = 'bot-token',
 Message = 'message',
 ShopType = 'shoptype',
 FormulaType = 'formulatype',
 Emote = 'emote',
 Emotes = 'emotes',
 Command = 'command',
 AutoModRules = 'automodrules',
 SettingLink = 'settinglink',
 AutoPunishment = 'auto-punishment',
 LvlUpMode = 'lvlupmode',
 Strings = 'strings',
 QuestionType = 'question-type',
 Category = 'category',
 Voice = 'voice',
 Permission = 'permission',
 RoleMode = 'rolemode',
 Commands = 'commands',
 Questions = 'questions',
 Position = 'position',
 ThreadAutoArchiveDuration = 'thread-archive-time',
 WeekendsType = 'weekends-type',
 TicketType = 'ticketing-type',
 TicketLogMode = 'ticket-log-mode',

 Ignore = '-'
}
