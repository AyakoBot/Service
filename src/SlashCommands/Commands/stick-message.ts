import { ContextMenuCommandBuilder } from '@discordjs/builders';
import {
 ApplicationCommandType,
 ApplicationIntegrationType,
 InteractionContextType,
 PermissionFlagsBits,
} from '@discordjs/core';

export default new ContextMenuCommandBuilder()
 .setName('Stick Message')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
 .setType(ApplicationCommandType.Message)
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
