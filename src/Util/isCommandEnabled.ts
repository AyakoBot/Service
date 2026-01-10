import type Client from '../Classes/Client.js';

export default async function (
 this: Client,
 commandName: string,
 guildId: string,
): Promise<{ response: boolean; debug: number }> {
 const commands = await this.cache.commands.getAll();
 const command = commands.find((c) => c.name === commandName);

 const guildCommands = await this.cache.guildCommands.getAll(guildId);
 const guildCommand = guildCommands.find((c) => c.name === commandName);

 if (!command && !guildCommand) return { response: true, debug: 1 };

 const commandPermissions = await this.cache.commandPermissions.getAll(guildId);

 const allRoles = commandPermissions.find((c) => c.id === guildId)?.permission || false;
 const allChannels =
  commandPermissions.find((c) => c.id === String(BigInt(guildId) - 1n))?.permission || false;

 return { response: allRoles && allChannels, debug: 2 };
}
