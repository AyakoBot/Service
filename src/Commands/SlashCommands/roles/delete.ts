import * as Discord from 'discord.js';

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 const role = cmd.options.getRole('role', true);

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.roles.delete;

 cmd.client.util.replyCmd(cmd, {
  content: lan.areYouSure(role as RRole),
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.Button,
      label: language.t.Yes,
      style: ButtonStyle.Danger,
      custom_id: `roles/delete_${role.id}`,
      emoji: cmd.client.util.emotes.warning,
     },
    ],
   },
  ],
 });
};
