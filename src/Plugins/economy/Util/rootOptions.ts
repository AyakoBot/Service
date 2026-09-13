import {
 ApplicationCommandOptionType,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

export const rootOptions = (
 cmd: APIApplicationCommandInteraction,
): APIApplicationCommandInteractionDataSubcommandOption =>
 ({
  name: cmd.data.name,
  type: ApplicationCommandOptionType.Subcommand,
  options: 'options' in cmd.data ? (cmd.data.options ?? []) : [],
 }) as APIApplicationCommandInteractionDataSubcommandOption;
