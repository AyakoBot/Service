import * as Discord from 'discord.js';
import { canEdit } from '../../../BaseClient/UtilModules/requestHandler/channels/edit.js';

export default async (cmd: Discord.ChatInputCommandInteraction<'cached'>) => {
 const channel = cmd.options.getChannel('channel', true, [
  ChannelType.GuildAnnouncement,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
 ]);
 const time = cmd.options.getNumber('time', true);
 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.slowmode;
 const me = await cmd.client.util.getBotMemberFromGuild(cmd.guild);

 if (!canEdit(channel, { rate_limit_per_user: 1 }, me)) {
  cmd.client.util.errorCmd(cmd, language.errors.cantManageChannel, language);
  return;
 }

 const res = await cmd.client.util.request.channels.edit(channel, {
  rate_limit_per_user: time,
 });

 if ('message' in res) {
  cmd.client.util.errorCmd(cmd, res, language);
  return;
 }

 cmd.client.util.replyCmd(cmd, {
  content:
   time === 0
    ? lan.deleted(channel as RChannel)
    : lan.success(channel as RChannel, cmd.client.util.moment(time * 1000, language)),
 });
};
