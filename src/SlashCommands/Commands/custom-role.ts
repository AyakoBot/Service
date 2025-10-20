import {
 SlashCommandAttachmentOption,
 SlashCommandBuilder,
 SlashCommandRoleOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandSubcommandGroupBuilder,
} from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';

const name = new SlashCommandStringOption()
 .setName('name')
 .setDescription('The Name of your Custom-Role')
 .setMaxLength(100)
 .setRequired(false);

const color = new SlashCommandStringOption()
 .setName('color')
 .setDescription('The new Color of the Role (Hex Code)')
 .setMaxLength(6)
 .setRequired(false);

const color2 = new SlashCommandStringOption()
 .setName('color-2')
 .setDescription('The second Color of the Role (Hex Code)')
 .setMaxLength(6)
 .setRequired(false);

const colorRole = new SlashCommandRoleOption()
 .setName('color-role')
 .setDescription('The Role to copy the Color from')
 .setRequired(false);

const colorRole2 = new SlashCommandRoleOption()
 .setName('color-role-2')
 .setDescription('The Role to copy the second Color from')
 .setRequired(false);

const icon = new SlashCommandAttachmentOption()
 .setName('icon')
 .setDescription('The new Icon of the Role')
 .setRequired(false);

const iconEmoji = new SlashCommandStringOption()
 .setName('icon-emoji')
 .setDescription('The new Icon of the Role derived from an Emoji')
 .setRequired(false);

const iconURL = new SlashCommandStringOption()
 .setName('icon-url')
 .setDescription('The new Icon of the Role derived from a URL')
 .setRequired(false);

export default new SlashCommandBuilder()
 .setName('custom-role')
 .setDescription('Create a Custom-Role')
 .setContexts([InteractionContextType.Guild])
 .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
 .addSubcommand(
  new SlashCommandSubcommandBuilder()
   .setName('create')
   .setDescription('Create your custom role')
   .addStringOption(name),
 )
 .addSubcommand(
  new SlashCommandSubcommandBuilder()
   .setName('edit-name')
   .setDescription('Edit the name of your custom role')
   .addStringOption(name),
 )
 .addSubcommand(
  new SlashCommandSubcommandBuilder()
   .setName('edit-icon')
   .setDescription('Edit the icon of your custom role')
   .addAttachmentOption(icon)
   .addStringOption(iconEmoji)
   .addStringOption(iconURL),
 )
 .addSubcommandGroup(
  new SlashCommandSubcommandGroupBuilder()
   .setName('edit-color')
   .setDescription('Edit the color of your custom role')
   .addSubcommand(
    new SlashCommandSubcommandBuilder()
     .setName('solid')
     .setDescription('Set a solid color for your custom role')
     .addStringOption(color)
     .addRoleOption(colorRole),
   )
   .addSubcommand(
    new SlashCommandSubcommandBuilder()
     .setName('gradient')
     .setDescription('Set a gradient color for your custom role')
     .addStringOption(color)
     .addStringOption(color2)
     .addRoleOption(colorRole)
     .addRoleOption(colorRole2),
   )
   .addSubcommand(
    new SlashCommandSubcommandBuilder()
     .setName('holographic')
     .setDescription('Set a your custom role to holographic'),
   ),
 )
 .addSubcommand(
  new SlashCommandSubcommandBuilder().setName('share').setDescription('Share a Custom-Role'),
 )
 .addSubcommand(
  new SlashCommandSubcommandBuilder()
   .setName('claim-shared')
   .setDescription('Claim a shared Custom-Role')
   .addStringOption(
    new SlashCommandStringOption()
     .setName('role')
     .setDescription('The Role to claim')
     .setRequired(true)
     .setAutocomplete(true),
   ),
 );
