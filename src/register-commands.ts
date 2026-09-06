import { RequestHandlerError } from '@ayako/api';
import { logger } from '@ayako/utility';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';

import registerCommandsSetup from './Util/registerCommandsSetup.js';

type Option = { name: string; type: number; options?: Option[] };
type Command = { name: string; type?: number; options?: Option[] };

const optionLimit = 25;

const isSubcommandTree = (options: Option[] | undefined): options is Option[] =>
 Array.isArray(options) &&
 options.length > 0 &&
 options.every(
  (option) =>
   option.type === ApplicationCommandOptionType.Subcommand ||
   option.type === ApplicationCommandOptionType.SubcommandGroup,
 );

const mergeOptions = (existing: Option[], incoming: Option[]): Option[] => {
 const byName = new Map<string, Option>();

 existing.forEach((option) => byName.set(option.name, option));
 incoming.forEach((option) => {
  const previous = byName.get(option.name);

  if (
   previous?.type === ApplicationCommandOptionType.SubcommandGroup &&
   option.type === ApplicationCommandOptionType.SubcommandGroup &&
   isSubcommandTree(previous.options) &&
   isSubcommandTree(option.options)
  ) {
   byName.set(option.name, {
    ...option,
    options: mergeOptions(previous.options, option.options),
   });
   return;
  }

  byName.set(option.name, option);
 });

 return [...byName.values()].slice(0, optionLimit);
};

const mergeCommand = (existing: Command, incoming: Command): Command => {
 if (!isSubcommandTree(existing.options) || !isSubcommandTree(incoming.options)) return incoming;

 return { ...incoming, options: mergeOptions(existing.options, incoming.options) };
};

const { api, body, delNames } = await registerCommandsSetup('[register]');

const existing = await api.applicationCommands.getGlobalCommands(undefined, {
 origin: 'register-commands',
 reason: 'Reading the current global commands before merging',
});

if (existing instanceof RequestHandlerError) {
 logger.error('[register] Could not read existing global commands; refusing to write.');
 process.exit(1);
}

const keyOf = (command: Command) => `${command.type ?? 1}:${command.name}`;
const merged = new Map<string, Command>();

existing
 .filter((command) => !delNames?.includes(command.name))
 .forEach((command) => merged.set(keyOf(command as Command), command as Command));

let mergedTrees = 0;

(body as unknown as Command[]).forEach((command) => {
 const previous = merged.get(keyOf(command));

 if (!previous) {
  merged.set(keyOf(command), command);
  return;
 }

 const result = mergeCommand(previous, command);
 if (result !== command) mergedTrees += 1;
 merged.set(keyOf(command), result);
});

const result = await api.applicationCommands.bulkOverwriteGlobalCommands(
 [...merged.values()] as Parameters<
  typeof api.applicationCommands.bulkOverwriteGlobalCommands
 >[0],
 { origin: 'register-commands', reason: 'Publishing the merged global command set' },
);

if (result instanceof RequestHandlerError) {
 logger.error('[register] Bulk overwrite failed; global commands are unchanged.');
 process.exit(1);
}

logger.log(
 `[register] ${merged.size} global commands live (${existing.length} existed, ` +
  `${body.length} from this package, ${mergedTrees} subcommand trees merged)`,
);
process.exit(0);
