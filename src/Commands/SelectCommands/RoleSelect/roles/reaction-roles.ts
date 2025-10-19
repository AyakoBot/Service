import * as Discord from 'discord.js';
import buttonRoles from './button-roles.js';

export default async (cmd: RRoleSelectMenuInteraction, args: string[]) =>
 buttonRoles(cmd, args, 'reaction-roles');
