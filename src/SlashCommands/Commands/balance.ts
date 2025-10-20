import { SlashCommandBuilder, SlashCommandUserOption } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';

export default new SlashCommandBuilder()
 .setName('balance')
 .setDescription('Display your Balance')
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
 .addUserOption(
  new SlashCommandUserOption().setName('user').setDescription('The User').setRequired(false),
 );
