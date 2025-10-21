import * as Discord from 'discord.js';
import * as CT from '../../../Typings/Typings.js';

export const buildEmbed = async (
 cmd:
  | Discord.ChatInputCommandInteraction
  | Discord.ButtonInteraction
  | Discord.StringSelectMenuInteraction,
 selectedOption?: string,
) => {
 if (!cmd.inCachedGuild()) return;

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.embedbuilder.create;
 const options = await getOptions(cmd);

 const payload: CT.UsualMessagePayload = {
  embeds: [
   {
    author: {
     name: lan.author,
    },
    description: lan.start.desc,
    color: CT.Colors.Ephemeral,
   },
  ],
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      label: lan.start.methods.startOver,
      custom_id: 'embed-builder/startOver',
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
     },
     {
      label: lan.start.methods.inheritCode,
      custom_id: 'embed-builder/inheritCode',
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.StringSelect,
      custom_id: 'embed-builder/select',
      min_values: 1,
      max_values: 1,
      placeholder: lan.start.methods.selectSaved,
      options: options.length
       ? options.map((o) => ({
          label: o.name,
          value: o.uniquetimestamp.toString(),
          default: o.uniquetimestamp.toString() === selectedOption,
         }))
       : [
          {
           label: '-',
           value: '-',
          },
         ],
      disabled: !options.length,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      label: lan.start.methods.inheritCustom,
      custom_id: 'embed-builder/inheritCustom',
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      disabled: !selectedOption,
     },
     {
      label: lan.start.methods.deleteCustom,
      custom_id: 'embed-builder/deleteCustom',
      type: ComponentType.Button,
      style: ButtonStyle.Danger,
      disabled:
       !selectedOption ||
       !cmd.memberPermissions?.has(Discord.PermissionsBitField.Flags.ManageGuild),
     },
    ],
   },
  ],
 };

 if (cmd.isStringSelectMenu() || cmd.isButton()) {
  cmd.update(payload as Discord.InteractionUpdateOptions);
 } else cmd.client.util.replyCmd(cmd, { ...payload, ephemeral: true });
};

export default buildEmbed;

const getOptions = async (
 cmd:
  | Discord.CommandInteraction<'cached'>
  | Discord.ButtonInteraction<'cached'>
  | Discord.StringSelectMenuInteraction<'cached'>,
) =>
 cmd.client.util.DataBase.customembeds
  .findMany({
   where: { guildid: cmd.guildId },
  })
  .then((r) => r ?? []);
