import * as Discord from 'discord.js';

export default async (cmd: Discord.ButtonInteraction<'cached'>, args: string[]) => {
 if (!cmd.channel) return;
 if (args[0] && args[0] !== cmd.user.id) return;

 if (
  ![Discord.ChannelType.PublicThread, Discord.ChannelType.PrivateThread].includes(cmd.channel.type)
 ) {
  return;
 }

 const res = await cmd.guild.client.util.request.channels.delete(cmd.channel);
 if (!('message' in res)) return;

 const language = await cmd.guild.client.util.getLanguage(cmd.guildId);
 cmd.guild.client.util.errorCmd(cmd, res, language);
};
