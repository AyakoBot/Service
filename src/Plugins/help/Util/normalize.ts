import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 type APIApplicationCommand,
 type APIApplicationCommandBasicOption,
 type APIApplicationCommandOption,
 type APIApplicationCommandOptionChoice,
 type APIApplicationCommandSubcommandGroupOption,
 type APIApplicationCommandSubcommandOption,
} from 'discord-api-types/v10';

import { fullNameOf, pathKey } from './path.js';

export enum HelpSource {
 Slash = 'slash',
 UserContext = 'user-context',
 MessageContext = 'message-context',
}

export enum HelpScope {
 Commands = 'commands',
 Settings = 'settings',
}

export enum HelpOptionKind {
 Attachment = 'Attachment',
 Boolean = 'Boolean',
 Channel = 'Channel',
 Mentionable = 'Mentionable',
 Number = 'Number',
 Role = 'Role',
 Text = 'Text',
 User = 'User',
}

export interface HelpOptionView {
 name: string;
 description: string;
 required: boolean;
 kind: HelpOptionKind;
 choices: string[] | null;
}

export interface HelpCommandView {
 name: string;
 path: string[];
 fullName: string;
 description: string;
 source: HelpSource;
 leaves: string[];
 options: HelpOptionView[];
}

export interface HelpSurface {
 leaves: string[];
 byPath: Map<string, HelpCommandView>;
 byName: Map<string, HelpCommandView[]>;
 topLevel: HelpCommandView[];
 contextMenus: HelpCommandView[];
}

const optionKinds: Record<number, HelpOptionKind> = {
 [ApplicationCommandOptionType.Attachment]: HelpOptionKind.Attachment,
 [ApplicationCommandOptionType.Boolean]: HelpOptionKind.Boolean,
 [ApplicationCommandOptionType.Channel]: HelpOptionKind.Channel,
 [ApplicationCommandOptionType.Integer]: HelpOptionKind.Number,
 [ApplicationCommandOptionType.Mentionable]: HelpOptionKind.Mentionable,
 [ApplicationCommandOptionType.Number]: HelpOptionKind.Number,
 [ApplicationCommandOptionType.Role]: HelpOptionKind.Role,
 [ApplicationCommandOptionType.String]: HelpOptionKind.Text,
 [ApplicationCommandOptionType.User]: HelpOptionKind.User,
};

const isTreeOption = (
 option: APIApplicationCommandOption,
): option is APIApplicationCommandSubcommandOption | APIApplicationCommandSubcommandGroupOption =>
 option.type === ApplicationCommandOptionType.Subcommand ||
 option.type === ApplicationCommandOptionType.SubcommandGroup;

const isBasicOption = (
 option: APIApplicationCommandOption,
): option is APIApplicationCommandBasicOption => !isTreeOption(option);

const choicesOf = (option: APIApplicationCommandBasicOption): string[] | null => {
 const choices = (option as { choices?: APIApplicationCommandOptionChoice<string | number>[] })
  .choices;
 if (!choices?.length) return null;

 return choices.map((choice) => String(choice.value));
};

const toOptionView = (option: APIApplicationCommandBasicOption): HelpOptionView => ({
 name: option.name,
 description: option.description,
 required: option.required ?? false,
 kind: optionKinds[option.type] ?? HelpOptionKind.Text,
 choices: choicesOf(option),
});

const childPaths = (
 path: string[],
 options: APIApplicationCommandOption[],
 collected: Map<string, HelpCommandView>,
): string[] =>
 options
  .filter(isTreeOption)
  .flatMap((option) =>
   buildPath([...path, option.name], option.description, option.options ?? [], collected),
  );

const buildPath = (
 path: string[],
 description: string,
 options: APIApplicationCommandOption[],
 collected: Map<string, HelpCommandView>,
): string[] => {
 const basicOptions = options.filter(isBasicOption);
 const descendants = childPaths(path, options, collected);
 const leaves = (descendants.length ? descendants : [fullNameOf(path)]).sort();

 collected.set(pathKey(path), {
  name: path[path.length - 1]!,
  path,
  fullName: fullNameOf(path),
  description,
  source: HelpSource.Slash,
  leaves,
  options: basicOptions.map(toOptionView),
 });

 return leaves;
};

const sourceOf = (type: ApplicationCommandType): HelpSource =>
 type === ApplicationCommandType.User ? HelpSource.UserContext : HelpSource.MessageContext;

const contextMenuOf = (command: APIApplicationCommand): HelpCommandView => ({
 name: command.name,
 path: [command.name],
 fullName: command.name,
 description: '',
 source: sourceOf(command.type as ApplicationCommandType),
 leaves: [],
 options: [],
});

const commandOf = (
 command: APIApplicationCommand,
 collected: Map<string, HelpCommandView>,
): HelpCommandView => {
 if (command.type !== ApplicationCommandType.ChatInput) return contextMenuOf(command);

 buildPath([command.name], command.description, command.options ?? [], collected);

 return collected.get(command.name)!;
};

export const normalizeCommands = (commands: APIApplicationCommand[]): HelpSurface => {
 const byPath = new Map<string, HelpCommandView>();
 const topLevel: HelpCommandView[] = [];
 const contextMenus: HelpCommandView[] = [];

 commands.forEach((command) => {
  const entry = commandOf(command, byPath);

  if (entry.source === HelpSource.Slash) topLevel.push(entry);
  else contextMenus.push(entry);
 });

 const every = [...byPath.values(), ...contextMenus];
 const byName = new Map<string, HelpCommandView[]>();

 every.forEach((entry) => {
  byName.set(entry.name, [...(byName.get(entry.name) ?? []), entry]);
 });

 const leaves = [...new Set(topLevel.flatMap((entry) => entry.leaves))].sort();
 return { leaves, byPath, byName, topLevel, contextMenus };
};
