import {
 SlashCommandBuilder,
 SlashCommandSubcommandGroupBuilder,
 type SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 PermissionFlagsBits,
 type RESTPostAPIChatInputApplicationCommandsJSONBody,
 type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from '@discordjs/core';

import type Client from '../Classes/Client.js';

import resolvePluginDependencies from './resolvePluginDependencies.js';
import universalCommands from './universalCommands.js';

export const settingsCommandName = 'settings';

const buildSettingsCommand = (plugins: Client['plugins']) => {
 const command = new SlashCommandBuilder()
  .setName(settingsCommandName)
  .setDescription('Configure ayako for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

 const byCategory = new Map<string, SlashCommandSubcommandBuilder[]>();

 plugins.forEach((plugin) => {
  plugin.getCommands().settings.forEach((entry) => {
   const key = entry.category ?? 'general';
   byCategory.set(key, [...(byCategory.get(key) ?? []), ...entry.commands]);
  });
 });

 if (!byCategory.size) return null;

 byCategory.forEach((subcommands, category) => {
  const group = new SlashCommandSubcommandGroupBuilder()
   .setName(category)
   .setDescription(`${category} settings`);

  subcommands.forEach((sub) => group.addSubcommand(sub));
  command.addSubcommandGroup(group);
 });

 return command;
};

const buildCommandBody = function (
 this: Client,
 only?: Client['plugins'][number],
): (
 | RESTPostAPIChatInputApplicationCommandsJSONBody
 | RESTPostAPIContextMenuApplicationCommandsJSONBody
)[] {
 const selected = only ? resolvePluginDependencies.call(this, only) : this.plugins;

 const standalone = selected.flatMap((plugin) => plugin.getCommands().commands);

 const bodies = [buildSettingsCommand(selected), ...standalone]
  .filter((command) => command !== null)
  .map((command) => command.toJSON());

 const names = new Set(bodies.map((body) => body.name));

 return [...bodies, ...universalCommands.call(this).filter((body) => !names.has(body.name))];
};

export default buildCommandBody;
