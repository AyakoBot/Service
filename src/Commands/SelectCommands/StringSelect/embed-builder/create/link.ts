import * as Discord from 'discord.js';
import { EmbedFields } from '../../../../../BaseClient/Other/constants/customEmbeds.js';

export default async (cmd: Discord.StringSelectMenuInteraction, args: string[]) => {
 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.embedbuilder.create.start;

 let title = lan.createButtons.selectMenu[args[0] as keyof typeof lan.createButtons.selectMenu];
 if (!title) {
  title = lan.createButtons.fieldButtons[args[0] as keyof typeof lan.createButtons.fieldButtons];
 }

 cmd.showModal({
  title,
  customId: `embed-builder/editor_${args[0]}`,
  components: [
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.TextInput,
      style: Discord.TextInputStyle.Short,
      customId: 'input',
      label: lan.modals.link.label,
      maxLength: 200,
      minLength: 0,
      placeholder: lan.modals.link.placeholder,
      required: false,
      value: getValue(args[0], cmd),
     },
    ],
   },
  ],
 });
};

const getValue = (arg: string, cmd: Discord.StringSelectMenuInteraction) => {
 const embed = cmd.message.embeds[1];
 if (!embed) return '';

 switch (arg) {
  case EmbedFields.AuthorURL:
   return embed.author?.url ?? '';
  case EmbedFields.URL:
   return embed.url ?? '';
  default:
   return '';
 }
};
