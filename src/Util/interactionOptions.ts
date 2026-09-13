import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandGroupOption,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

type OptionCarrier =
 | APIApplicationCommandInteraction
 | APIApplicationCommandAutocompleteInteraction;

export const getSubcommand = (
 cmd: OptionCarrier,
): APIApplicationCommandInteractionDataSubcommandOption | null => {
 if (!('options' in cmd.data)) return null;
 const top = cmd.data.options?.[0];
 if (!top || top.type !== ApplicationCommandOptionType.Subcommand) return null;
 return top;
};

export const getSubcommandGroup = (
 cmd: OptionCarrier,
): APIApplicationCommandInteractionDataSubcommandGroupOption | null => {
 if (!('options' in cmd.data)) return null;
 const top = cmd.data.options?.[0];
 if (!top || top.type !== ApplicationCommandOptionType.SubcommandGroup) return null;
 return top;
};

export const getGroupSubcommand = (
 cmd: OptionCarrier,
): APIApplicationCommandInteractionDataSubcommandOption | null => {
 const group = getSubcommandGroup(cmd);
 const leaf = group?.options?.[0];
 if (!leaf || leaf.type !== ApplicationCommandOptionType.Subcommand) return null;
 return leaf;
};

export const hasOption = (
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 name: string,
): boolean => !!sub.options?.some((o) => o.name === name);

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

type FocusedOption = { name: string; value: string };
type FocusedOptions = APIApplicationCommandAutocompleteInteraction['data']['options'];

export const findFocusedOption = (options: FocusedOptions): FocusedOption | null => {
 for (const option of options ?? []) {
  if (
   option.type === ApplicationCommandOptionType.Subcommand ||
   option.type === ApplicationCommandOptionType.SubcommandGroup
  ) {
   const nested = findFocusedOption(option.options as FocusedOptions);
   if (nested) return nested;
  }

  if (option.type === ApplicationCommandOptionType.String && option.focused) {
   return { name: option.name, value: option.value };
  }
 }

 return null;
};

export const findFocusedString = (options: FocusedOptions): string =>
 findFocusedOption(options)?.value ?? '';
