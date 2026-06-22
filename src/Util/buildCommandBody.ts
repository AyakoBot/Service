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

const buildSettingsCommand = (client: Client, only?: Client['plugins'][number]) => {
 const command = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configure ayako for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

 const byCategory = new Map<string, SlashCommandSubcommandBuilder[]>();

 (only ? [only] : client.plugins).forEach((plugin) => {
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

const buildCommandBody = (
 client: Client,
 only?: Client['plugins'][number],
): RESTPostAPIChatInputApplicationCommandsJSONBody[] => {
 const standalone = (only ? [only] : client.plugins).flatMap(
  (plugin) => plugin.getCommands().commands,
 );

 return [buildSettingsCommand(client, only), ...standalone].map((command) => command.toJSON());
};

export default buildCommandBody;
