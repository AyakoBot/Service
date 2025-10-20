import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';

export default new SlashCommandBuilder()
 .setName('membercount')
 .setDescription('Display the Membercount of a Server')
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([
  ApplicationIntegrationType.GuildInstall,
  ApplicationIntegrationType.UserInstall,
 ]);
