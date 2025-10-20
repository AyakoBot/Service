import { ContextMenuCommandBuilder } from '@discordjs/builders';
import {
 ApplicationCommandType,
 ApplicationIntegrationType,
 InteractionContextType,
} from '@discordjs/core';

export default new ContextMenuCommandBuilder()
 .setName('View Raw')
 .setType(ApplicationCommandType.Message)
 .setContexts([
  InteractionContextType.Guild,
  InteractionContextType.BotDM,
  InteractionContextType.PrivateChannel,
 ])
 .setIntegrationTypes([
  ApplicationIntegrationType.GuildInstall,
  ApplicationIntegrationType.UserInstall,
 ]);
