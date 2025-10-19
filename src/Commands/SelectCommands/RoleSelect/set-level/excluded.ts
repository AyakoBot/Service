import * as Discord from 'discord.js';
import { getEmbed } from '../../../SlashCommands/settings/leveling/set-level-role.js';

export default async (cmd: RRoleSelectMenuInteraction, args: string[]) => {
 if (!cmd.inCachedGuild()) return;

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const role = cmd.guild.roles.cache.get(args.shift() as string);
 if (!role) {
  cmd.client.util.errorCmd(cmd, language.errors.roleNotFound, language);
  return;
 }

 const xp = Number(cmd.message.embeds[0].fields[0].value.replace(/,/g, ''));
 const level = Number(cmd.message.embeds[0].fields[1].value.replace(/,/g, ''));
 const embed = getEmbed(language, role, xp, level, cmd.values);

 cmd.update({ embeds: [embed] });
};
