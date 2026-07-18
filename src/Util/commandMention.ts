import { RequestHandlerError, type API } from '@ayako/api';

export type CommandMention = (name: string) => string;

export const plainCommand: CommandMention = (name) => `\`/${name}\``;

const registries = new Map<string, Promise<Map<string, string> | null>>();

const fetchRegistry = async (api: API): Promise<Map<string, string> | null> => {
 const commands = await api.applicationCommands.getGlobalCommands(undefined, {
  origin: 'Command Mention',
  reason: 'Command id lookup',
 });
 if (commands instanceof RequestHandlerError) return null;

 return new Map(commands.map((command) => [command.name, command.id]));
};

export const commandMentions = async function (this: API): Promise<CommandMention> {
 const registry = registries.get(this.botId) ?? fetchRegistry(this);
 registries.set(this.botId, registry);

 const commands = await registry;
 if (!commands) {
  registries.delete(this.botId);
  return plainCommand;
 }

 return (name) => {
  const id = commands.get(name.split(' ')[0]);
  return id ? `</${name}:${id}>` : plainCommand(name);
 };
};

export default async function (this: API, name: string) {
 return (await commandMentions.call(this))(name);
}
