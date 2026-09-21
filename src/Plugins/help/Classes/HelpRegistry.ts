import { RequestHandlerError, type API } from '@ayako/api';
import type {
 APIApplicationCommand,
 APIApplicationCommandOption,
 APIApplicationCommandSubcommandGroupOption,
 APIApplicationCommandSubcommandOption,
 APIInteraction,
} from 'discord-api-types/v10';
import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { settingsCommandName } from '../../../Util/buildCommandBody.js';
import { botNameOf } from '../Util/botName.js';
import localSurface from '../Util/localSurface.js';
import { normalizeCommands } from '../Util/normalize.js';
import type HelpPlugin from '../Plugin.js';
import { settingsFullName, type HelpPanelData, type HelpSettingsEntry } from './HelpTypes.js';

const isSubcommandGroup = (
 option: APIApplicationCommandOption,
): option is APIApplicationCommandSubcommandGroupOption =>
 option.type === ApplicationCommandOptionType.SubcommandGroup;

const isSubcommand = (
 option: APIApplicationCommandOption,
): option is APIApplicationCommandSubcommandOption =>
 option.type === ApplicationCommandOptionType.Subcommand;

const settingsEntries = (commands: APIApplicationCommand[]): HelpSettingsEntry[] => {
 const settings = commands.find(
  (command) =>
   command.name === settingsCommandName && command.type === ApplicationCommandType.ChatInput,
 );
 if (!settings) return [];

 return (settings.options ?? []).filter(isSubcommandGroup).flatMap((group) =>
  (group.options ?? []).filter(isSubcommand).map((option) => ({
   category: group.name,
   name: option.name,
   description: option.description,
   fullName: settingsFullName(group.name, option.name),
  })),
 );
};

interface CommandSource {
 commands: APIApplicationCommand[];
 degraded: boolean;
}

interface CacheEntry {
 data: HelpPanelData;
 readAt: number;
}

const cacheTtlMs = 30 * 60 * 1000;

const cacheKey = (botId: string, guildId: string): string => `${botId}:${guildId}`;

export default class HelpRegistry {
 plugin: HelpPlugin;
 client: Client;
 private cache: Map<string, CacheEntry> = new Map();

 constructor(plugin: HelpPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 read = async (cmd: APIInteraction): Promise<HelpPanelData> => {
  const api = await this.plugin.getInteractionAPI(cmd);
  const guildId = cmd.guild_id ?? '';
  const key = cacheKey(api.botId, guildId);
  const cached = this.cache.get(key);

  if (cached && Date.now() - cached.readAt < cacheTtlMs) return cached.data;

  const source = await this.readSource(api, cmd.guild_id ?? undefined);
  const data: HelpPanelData = {
   surface: normalizeCommands(source.commands),
   settings: settingsEntries(source.commands),
   botId: api.botId,
   botName: await botNameOf.call(api),
   degraded: source.degraded,
  };

  this.cache.set(key, { data, readAt: Date.now() });

  return data;
 };

 private readSource = async (api: API, guildId?: string): Promise<CommandSource> => {
  const guild = guildId ? await this.readGuild(api, guildId) : null;
  if (guild?.commands.length) return guild;

  const global = await this.readGlobal(api);
  if (global.commands.length || !global.degraded) return global;

  this.plugin.nonFatalError(
   new Error(`Could not read the command list for application ${api.botId}`),
   'HelpRegistry.read',
  );

  return { commands: this.fallbackCommands(api.botId), degraded: true };
 };

 private readGuild = async (api: API, guildId: string): Promise<CommandSource | null> => {
  const result = await api.applicationCommands.getGuildCommands(guildId, undefined, {
   origin: this.plugin.name,
   reason: 'Help command list lookup',
  });

  return result instanceof RequestHandlerError ? null : { commands: result, degraded: false };
 };

 private readGlobal = async (api: API): Promise<CommandSource> => {
  const result = await api.applicationCommands.getGlobalCommands(undefined, {
   origin: this.plugin.name,
   reason: 'Help command list lookup',
  });

  return result instanceof RequestHandlerError
   ? { commands: [], degraded: true }
   : { commands: result, degraded: false };
 };

 private fallbackCommands = (botId: string): APIApplicationCommand[] => {
  const surface = localSurface.call(this.client, botId);

  return surface.commands as APIApplicationCommand[];
 };
}
