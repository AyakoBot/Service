import { StoredPunishmentTypes } from '@prisma/client';
import * as Discord from 'discord.js';

export default async (
 _oldChannel:
  | Discord.CategoryChannel
  | RChannel
  | RChannel
  | RChannel
  | RThread
  | RThread
  | Discord.VoiceChannel
  | Discord.ForumChannel
  | Discord.MediaChannel
  | undefined,
 channel:
  | Discord.CategoryChannel
  | RChannel
  | RChannel
  | RChannel
  | Discord.AnyThreadChannel
  | Discord.VoiceChannel
  | Discord.MediaChannel
  | Discord.ForumChannel,
) => {
 if (channel.isThread()) return;
 if (channel.type === ChannelType.GuildCategory) return;

 const perms = channel.permissionOverwrites.cache
  .filter((p) => p.type === Discord.OverwriteType.Member)
  .map((o) => o);
 if (!perms?.length) return;

 const res = await channel.client.util.DataBase.punishments.findMany({
  where: {
   guildid: channel.guild.id,
   context: channel.id,
   type: StoredPunishmentTypes.tempchannelban,
  },
 });

 if (!res.length) return;

 res
  .filter((r) => {
   const applyingPerm = perms.find((p) => p.id === r.userid);
   if (!applyingPerm) return true;

   return (
    !applyingPerm.deny.has(PermissionFlagsBits.SendMessages) ||
    !applyingPerm.deny.has(PermissionFlagsBits.SendMessagesInThreads) ||
    !applyingPerm.deny.has(PermissionFlagsBits.ViewChannel) ||
    !applyingPerm.deny.has(PermissionFlagsBits.AddReactions) ||
    !applyingPerm.deny.has(PermissionFlagsBits.Connect)
   );
  })
  .forEach(async (data) => {
   channel.client.util.DataBase.punishments
    .update({
     where: { uniquetimestamp: data.uniquetimestamp },
     data: { type: StoredPunishmentTypes.channelban },
    })
    .then();
  });
};
