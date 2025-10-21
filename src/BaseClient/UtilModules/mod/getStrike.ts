import * as Discord from 'discord.js';

import DataBase from '../../DataBase.js';
import getPunishment from '../getPunishment.js';

export default async (user: RUser, guild: RGuild) => {
 const punishments = await getPunishment(user.id, { identType: 'all-on', guildid: guild.id });

 return DataBase.autopunish.findFirst({
  where: {
   guildid: guild.id,
   active: true,
   warnamount: { lte: Number(punishments?.length) },
  },
  orderBy: { warnamount: 'desc' },
 });
};
