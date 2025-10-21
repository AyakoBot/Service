import * as Discord from 'discord.js';

export default (
 components: Discord.APIActionRowComponent<Discord.APIComponentInMessageActionRow>[],
): Discord.APIActionRowComponent<Discord.APIComponentInMessageActionRow>[] =>
 components.map((c) => ({
  type: ComponentType.ActionRow,
  components: c.components.map((button) => ({
   ...button,
   disabled: !(
    button.type === ComponentType.Button && button.style === ButtonStyle.Link
   ),
  })),
 }));
