import getGlobalCommands from './commands/getGlobalCommands.js';
import createGlobalCommand from './commands/createGlobalCommand.js';
import getGlobalCommand from './commands/getGlobalCommand.js';
import editGlobalCommand from './commands/editGlobalCommand.js';
import deleteGlobalCommand from './commands/deleteGlobalCommand.js';
import bulkOverwriteGlobalCommands from './commands/bulkOverwriteGlobalCommands.js';
import getGuildCommands from './commands/getGuildCommands.js';
import createGuildCommand from './commands/createGuildCommand.js';
import getGuildCommand from './commands/getGuildCommand.js';
import editGuildCommand from './commands/editGuildCommand.js';
import deleteGuildCommand from './commands/deleteGuildCommand.js';
import bulkOverwriteGuildCommands from './commands/bulkOverwriteGuildCommands.js';
import getGuildCommandPermissions from './commands/getGuildCommandPermissions.js';
import getGuildCommandsPermissions from './commands/getGuildCommandsPermissions.js';
import editGuildCommandPermissions from './commands/editGuildCommandPermissions.js';

interface Commands {
 getGlobalCommands: typeof getGlobalCommands;
 createGlobalCommand: typeof createGlobalCommand;
 getGlobalCommand: typeof getGlobalCommand;
 editGlobalCommand: typeof editGlobalCommand;
 deleteGlobalCommand: typeof deleteGlobalCommand;
 bulkOverwriteGlobalCommands: typeof bulkOverwriteGlobalCommands;
 getGuildCommands: typeof getGuildCommands;
 createGuildCommand: typeof createGuildCommand;
 getGuildCommand: typeof getGuildCommand;
 editGuildCommand: typeof editGuildCommand;
 deleteGuildCommand: typeof deleteGuildCommand;
 bulkOverwriteGuildCommands: typeof bulkOverwriteGuildCommands;
 getGuildCommandPermissions: typeof getGuildCommandPermissions;
 getGuildCommandsPermissions: typeof getGuildCommandsPermissions;
 editGuildCommandPermissions: typeof editGuildCommandPermissions;
}

/**
 * Object containing methods for interacting with global and guild commands.
 * @property {Function} getGlobalCommands
 * - Method to get all global commands.
 * @property {Function} createGlobalCommand
 * - Method to create a new global command.
 * @property {Function} getGlobalCommand
 * - Method to get a specific global command by ID.
 * @property {Function} editGlobalCommand
 * - Method to edit a specific global command by ID.
 * @property {Function} deleteGlobalCommand
 * - Method to delete a specific global command by ID.
 * @property {Function} bulkOverwriteGlobalCommands
 * - Method to bulk overwrite all global commands.
 * @property {Function} getGuildCommands
 * - Method to get all guild commands for a specific guild.
 * @property {Function} createGuildCommand
 * - Method to create a new guild command for a specific guild.
 * @property {Function} getGuildCommand
 * - Method to get a specific guild command by ID for a specific guild.
 * @property {Function} editGuildCommand
 * - Method to edit a specific guild command by ID for a specific guild.
 * @property {Function} deleteGuildCommand
 * - Method to delete a specific guild command by ID for a specific guild.
 * @property {Function} bulkOverwriteGuildCommands
 * - Method to bulk overwrite all guild commands for a specific guild.
 * @property {Function} getGuildCommandPermissions
 * - Method to get the permissions for a specific guild command by ID for a specific guild.
 * @property {Function} getGuildCommandsPermissions
 * - Method to get the permissions for all guild commands for a specific guild.
 * @property {Function} editGuildCommandPermissions
 * - Method to edit the permissions for a specific guild command by ID for a specific guild.
 */
const commands: Commands = {
 getGlobalCommands,
 createGlobalCommand,
 getGlobalCommand,
 editGlobalCommand,
 deleteGlobalCommand,
 bulkOverwriteGlobalCommands,
 getGuildCommands,
 createGuildCommand,
 getGuildCommand,
 editGuildCommand,
 deleteGuildCommand,
 bulkOverwriteGuildCommands,
 getGuildCommandPermissions,
 getGuildCommandsPermissions,
 editGuildCommandPermissions,
};

export default commands;
