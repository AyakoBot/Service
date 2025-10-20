import * as Discord from 'discord.js';
import Commands from '../../../SlashCommands/index.js';
import * as CT from '../../../Typings/Typings.js';
import permissions from '../../SlashCommands/mod/permissions.js';

type CommandType = keyof CT.Language['slashCommands']['moderation']['permissions']['buttons'];

export default async (cmd: Discord.ButtonInteraction, args: CommandType[]) => {
 if (!cmd.inCachedGuild()) return;

 const response = await cmd.deferReply({ ephemeral: true });
 cmd.editReply({
  components: cmd.message.components.map((actionRow) => ({
   type: actionRow.type,
   components: (actionRow as Discord.ActionRow<RMessageActionRowComponent>).components.map(
    (c) => ({
     ...c.data,
     disabled: true,
    }),
   ),
  })),
  message: cmd.message,
 });

 const name = args.shift() as CommandType;
 if (!name) {
  cmd.client.util.error(cmd.guild, new Error('No name provided'));
  return;
 }

 const command = await cmd.client.util.getCustomCommand(cmd.guild, name);

 if (command) {
  await cmd.client.util.request.commands.deleteGuildCommand(cmd.guild, command.id);
  permissions(cmd, [], response);
  return;
 }

 const submitCmdData = registerCmd(name, cmd.guild);
 if (!submitCmdData) {
  cmd.client.util.error(cmd.guild, new Error("Couldn't register Command"));
  return;
 }

 await cmd.client.util.request.commands.createGuildCommand(cmd.guild, submitCmdData);
 permissions(cmd, [], response);
};

export const registerCmd = (commandName: CommandType, guild: Discord.Guild) => {
 const mainCmd = Commands.public.mod.toJSON();
 const cmdData = mainCmd.options?.find((o) => o.name === commandName);
 if (!cmdData) {
  guild.client.util.error(guild, new Error('Command-Option not found'));
  return undefined;
 }

 const submitCmd = new SlashCommandBuilder()
  .setName(cmdData.name)
  .setDescription(cmdData.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts([InteractionContextType.Guild])
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
  .setNameLocalizations(cmdData.name_localizations || null)
  .setDescriptionLocalizations(cmdData.description_localizations || null)
  .toJSON();

 if (
  [
   RCommandOptionType.Subcommand,
   RCommandOptionType.SubcommandGroup,
  ].includes(cmdData.type) &&
  'options' in cmdData &&
  cmdData.options
 ) {
  submitCmd.options = cmdData.options;
 }

 return submitCmd;
};
