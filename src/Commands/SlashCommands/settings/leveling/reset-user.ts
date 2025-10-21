import * as Discord from 'discord.js';
import client from '../../../../BaseClient/Client.js';

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 const language = await client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.resetLevels;
 const user = cmd.options.getUser('user', true);

 await client.util.replyCmd(cmd, {
  content: lan.confirmUser(user),
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      emoji: client.util.emotes.tickWithBackground,
      style: ButtonStyle.Danger,
      custom_id: `reset-levels/confirm_user_${user.id}`,
      type: ComponentType.Button,
     },
     {
      emoji: client.util.emotes.crossWithBackground,
      style: ButtonStyle.Secondary,
      custom_id: 'reset-levels/reject',
      type: ComponentType.Button,
     },
    ],
   },
  ],
 });
};
