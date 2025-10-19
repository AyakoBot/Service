import * as Discord from 'discord.js';
import { oneTimeRunner } from '../../../../Events/BotEvents/guildEvents/guildMemberUpdate/separator.js';

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 oneTimeRunner(cmd, cmd.guild);
};
