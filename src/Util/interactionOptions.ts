import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandGroupOption,
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

export const getSubcommandGroup = (
 cmd: APIApplicationCommandInteraction,
): APIApplicationCommandInteractionDataSubcommandGroupOption | null => {
 if (!('options' in cmd.data)) return null;
 const top = cmd.data.options?.[0];
 if (!top || top.type !== ApplicationCommandOptionType.SubcommandGroup) return null;
 return top;
};

export const getIntegerOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): number | null => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.Integer
  ? Number(option.value)
  : null;
};

export const getStringOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): string => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.String ? option.value : '';
};

export const getBooleanOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
 fallback: boolean,
): boolean => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.Boolean ? option.value : fallback;
};

export const getUserOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): string | null => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.User ? option.value : null;
};

export const getChannelOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): string | null => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.Channel ? option.value : null;
};

export const getRoleOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): string | null => {
 const option = sub.options?.find((o) => o.name === name);
 return option && option.type === ApplicationCommandOptionType.Role ? option.value : null;
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
