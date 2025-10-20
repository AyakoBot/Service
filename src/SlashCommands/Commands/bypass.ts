import { SlashCommandBuilder, SlashCommandUserOption } from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 InteractionContextType,
 PermissionFlagsBits,
} from '@discordjs/core';

export default new SlashCommandBuilder()
 .setName('bypass')
 .setDescription('Bypasses a Member from the Verification-System')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
 .addUserOption(
  new SlashCommandUserOption()
   .setName('user')
   .setDescription('The User to bypass')
   .setRequired(true),
 );
