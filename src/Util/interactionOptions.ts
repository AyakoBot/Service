import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

export const getSubcommand = (
 cmd: APIApplicationCommandInteraction,
): APIApplicationCommandInteractionDataSubcommandOption | null => {
 if (!('options' in cmd.data)) return null;
 const top = cmd.data.options?.[0];
 if (!top || top.type !== ApplicationCommandOptionType.Subcommand) return null;
 return top;
};

export const getStringOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): string => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.String ? option.value : '';
};

export const findFocusedString = (
 options: APIApplicationCommandAutocompleteInteraction['data']['options'],
): string => {
 for (const option of options ?? []) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
   const nested = option.options?.find(
    (o) => o.type === ApplicationCommandOptionType.String && o.focused,
   );
   if (nested && nested.type === ApplicationCommandOptionType.String) return nested.value;
  }
  if (option.type === ApplicationCommandOptionType.String && option.focused) return option.value;
 }
 return '';
};
