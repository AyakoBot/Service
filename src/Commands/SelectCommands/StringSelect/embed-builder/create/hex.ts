import * as Discord from 'discord.js';

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
      style: Discord.TextInputStyle.Paragraph,
      customId: 'input',
      label: lan.modals.hex.label,
      maxLength: 200,
      minLength: 0,
      required: false,
      value: cmd.message.embeds[1].color ? `#${cmd.message.embeds[1].color?.toString(16)}` : '',
     },
    ],
   },
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.TextInput,
      style: Discord.TextInputStyle.Paragraph,
      customId: '-',
      label: lan.modals.hex.label,
      required: false,
      value: lan.modals.hex.placeholder,
     },
    ],
   },
  ],
 });
};
