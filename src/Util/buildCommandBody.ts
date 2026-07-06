import {
 SlashCommandBuilder,
 SlashCommandSubcommandGroupBuilder,
 type SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 PermissionFlagsBits,
 type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from '@discordjs/core';

import type Client from '../Classes/Client.js';

import resolvePluginDependencies from './resolvePluginDependencies.js';

const buildSettingsCommand = (plugins: Client['plugins']) => {
 const command = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configure ayako for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

 const byCategory = new Map<string, SlashCommandSubcommandBuilder[]>();

 plugins.forEach((plugin) => {
  plugin.getCommands().settings.forEach((entry) => {
   const key = entry.category ?? 'general';
   byCategory.set(key, [...(byCategory.get(key) ?? []), ...entry.commands]);
  });
 });

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
): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
 const selected = only ? resolvePluginDependencies.call(this, only) : this.plugins;

 const standalone = selected.flatMap((plugin) => plugin.getCommands().commands);

 return [buildSettingsCommand(selected), ...standalone].map((command) => command.toJSON());
};

export default buildCommandBody;
