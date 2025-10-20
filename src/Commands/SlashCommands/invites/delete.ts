import * as Discord from 'discord.js';
import { canDeleteInvite } from '../../../BaseClient/UtilModules/requestHandler/invites/delete.js';

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 const reason = cmd.options.getString('reason', false);
 const inviteCodeOrLink = cmd.options.getString('invite', true);
 const isUrl =
  inviteCodeOrLink.includes('discord.gg') || inviteCodeOrLink.includes('discordapp.com/invite/');
 const inviteCode = isUrl
  ? new URL(
     inviteCodeOrLink.replace(/^[^http]/gm, 'https://d').replace('http://', 'https://'),
    ).pathname?.replace('/', '')
  : inviteCodeOrLink;
 const invite = cmd.guild.invites.cache.get(inviteCode);

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.invites;

 if (!invite) {
  cmd.client.util.errorCmd(cmd, lan.inviteNotFound, language);
  return;
 }

 if (canDelete(invite, cmd.user)) {
  cmd.client.util.errorCmd(cmd, lan.cantDeleteInvite, language);
  return;
 }

 const me = await cmd.client.util.getBotMemberFromGuild(cmd.guild);

 const channel = cmd.client.channels.cache.get(invite.channelId as string);
 if (!channel || !('permissionsFor' in channel)) {
  cmd.client.util.errorCmd(cmd, language.errors.cantManageInvite, language);
  return;
 }

 if (!channel?.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) {
  cmd.client.util.errorCmd(cmd, language.errors.cantManageInvite, language);
  return;
 }

 const response = await cmd.client.util.request.invites.delete(
  cmd.guild,
  invite.code,
  `${cmd.user.displayName}${reason ? `: ${reason}` : ''}`,
 );

 if (response && 'message' in response) {
  cmd.client.util.errorCmd(cmd, response.message, language);
  return;
 }

 cmd.client.util.replyCmd(cmd, { content: lan.deleted(invite) });
};

const canDelete = (invite: RInvite, user: RUser) => {
 if (!invite.guild) return false;
 if (!('members' in invite.guild)) return false;

 const member = invite.guild.members.cache.get(user.id);
 if (!member) return false;

 return canDeleteInvite(member, invite.channelId ?? '');
};
