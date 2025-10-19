import * as Discord from 'discord.js';

export default new Discord.SlashCommandBuilder()
 .setName('self-roles')
 .setDescription('Get yourself some Self-Assignable Roles')
 .setContexts([Discord.InteractionContextType.Guild])
 .setIntegrationTypes([Discord.ApplicationIntegrationType.GuildInstall])
 .addStringOption(
  new Discord.SlashCommandStringOption()
   .setName('category')
   .setDescription('The Category of Self-Roles you want to see')
   .setRequired(true)
   .setAutocomplete(true),
 );
