import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';

export default new SlashCommandBuilder()
 .setName('shop')
 .setDescription('Buy Roles with earned Currency')
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
