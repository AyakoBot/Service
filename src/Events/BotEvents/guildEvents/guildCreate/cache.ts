import * as Discord from 'discord.js';
import stickyPerms from '../../channelEvents/channelUpdate/stickyPerms.js';
import { startupTasks } from '../../readyEvents/startupTasks/cache.js';

export default (guild: RGuild) => {
 Object.values(startupTasks).forEach((t) => t([guild.id]));

 guild.channels.cache
  .filter(
   (c) =>
    c.type !== ChannelType.PublicThread &&
    c.type !== ChannelType.PrivateThread &&
    c.type !== ChannelType.AnnouncementThread,
  )
  .forEach((c) => stickyPerms(undefined, c as RChannel));

 guild.client.util.DataBase.guilds
  .create({
   data: {
    fetchat: Date.now(),
    guildid: guild.id,
    name: guild.name,
    banner: guild.bannerURL(),
    icon: guild.iconURL(),
    invite: guild.vanityURLCode,
    membercount: guild.memberCount,
   },
  })
  .then();
};
