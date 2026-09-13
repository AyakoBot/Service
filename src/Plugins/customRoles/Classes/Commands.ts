import {
 SlashCommandAttachmentOption,
 SlashCommandBuilder,
 SlashCommandRoleOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandSubcommandGroupBuilder,
} from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';

export enum CustomRoleCommand {
 CustomRole = 'custom-role',
}

export enum CustomRoleSubcommand {
 Create = 'create',
 Delete = 'delete',
 EditName = 'edit-name',
 EditIcon = 'edit-icon',
 Share = 'share',
 ClaimShared = 'claim-shared',
}

export enum CustomRoleGroup {
 EditColor = 'edit-color',
}

export enum CustomRoleColorSubcommand {
 Solid = 'solid',
 Gradient = 'gradient',
 Holographic = 'holographic',
}

export enum CustomRoleOption {
 Name = 'name',
 Color = 'color',
 ColorTwo = 'color-2',
 ColorRole = 'color-role',
 ColorRoleTwo = 'color-role-2',
 Icon = 'icon',
 IconEmoji = 'icon-emoji',
 IconUrl = 'icon-url',
 Role = 'role',
}

export enum CustomRoleModalField {
 IconEmoji = 'iconemoji',
 IconUrl = 'iconurl',
}

export const ROLE_NAME_LIMIT = 100;

const nameOption = () =>
 new SlashCommandStringOption()
  .setName(CustomRoleOption.Name)
  .setDescription('The Name of your Custom-Role (leave empty to use your Display-Name)')
  .setMaxLength(ROLE_NAME_LIMIT)
  .setRequired(false);

const colorOption = (name: CustomRoleOption, description: string) =>
 new SlashCommandStringOption()
  .setName(name)
  .setDescription(description)
  .setMinLength(6)
  .setMaxLength(7)
  .setRequired(false);

const roleOption = (name: CustomRoleOption, description: string) =>
 new SlashCommandRoleOption().setName(name).setDescription(description).setRequired(false);

const editColorGroup = () =>
 new SlashCommandSubcommandGroupBuilder()
  .setName(CustomRoleGroup.EditColor)
  .setDescription('Edit the Colour of your Custom-Role')
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleColorSubcommand.Solid)
    .setDescription('Set a solid Colour on your Custom-Role')
    .addStringOption(colorOption(CustomRoleOption.Color, 'The Colour, as Hex (#ff0000)'))
    .addRoleOption(roleOption(CustomRoleOption.ColorRole, 'Take the Colour from this Role')),
  )
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleColorSubcommand.Gradient)
    .setDescription('Set a two-Colour Gradient on your Custom-Role')
    .addStringOption(colorOption(CustomRoleOption.Color, 'The first Colour, as Hex (#ff0000)'))
    .addStringOption(colorOption(CustomRoleOption.ColorTwo, 'The second Colour, as Hex (#ff0000)'))
    .addRoleOption(roleOption(CustomRoleOption.ColorRole, 'Take the first Colour from this Role'))
    .addRoleOption(
     roleOption(CustomRoleOption.ColorRoleTwo, 'Take the second Colour from this Role'),
    ),
  )
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleColorSubcommand.Holographic)
    .setDescription('Set the Holographic Style on your Custom-Role'),
  );

const editIconSubcommand = () =>
 new SlashCommandSubcommandBuilder()
  .setName(CustomRoleSubcommand.EditIcon)
  .setDescription('Edit the Icon of your Custom-Role (leave empty to type one in)')
  .addStringOption(
   new SlashCommandStringOption()
    .setName(CustomRoleOption.IconEmoji)
    .setDescription('An Emoji to use as the Icon')
    .setRequired(false),
  )
  .addAttachmentOption(
   new SlashCommandAttachmentOption()
    .setName(CustomRoleOption.Icon)
    .setDescription('An Image to use as the Icon')
    .setRequired(false),
  )
  .addStringOption(
   new SlashCommandStringOption()
    .setName(CustomRoleOption.IconUrl)
    .setDescription('A Discord CDN link to use as the Icon')
    .setRequired(false),
  );

export const customRoleCommand = () =>
 new SlashCommandBuilder()
  .setName(CustomRoleCommand.CustomRole)
  .setDescription('Create and manage your own Custom-Role')
  .setContexts([InteractionContextType.Guild])
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleSubcommand.Create)
    .setDescription('Create your Custom-Role')
    .addStringOption(nameOption()),
  )
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleSubcommand.Delete)
    .setDescription('Delete your Custom-Role'),
  )
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleSubcommand.EditName)
    .setDescription('Edit the Name of your Custom-Role')
    .addStringOption(nameOption()),
  )
  .addSubcommand(editIconSubcommand())
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleSubcommand.Share)
    .setDescription('Share your Custom-Role with other Members'),
  )
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(CustomRoleSubcommand.ClaimShared)
    .setDescription('Claim a Custom-Role someone shared with you')
    .addStringOption(
     new SlashCommandStringOption()
      .setName(CustomRoleOption.Role)
      .setDescription('The Role to claim')
      .setRequired(true)
      .setAutocomplete(true),
    ),
  )
  .addSubcommandGroup(editColorGroup());
