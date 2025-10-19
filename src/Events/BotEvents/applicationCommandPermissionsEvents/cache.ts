import type * as Discord from 'discord.js';
import client from '../../../BaseClient/Client.js';

export default async (
 data: RCommandPermissionsUpdateData,
 guild: Discord.Guild,
) => {
 const cache = () => {
  client.util.cache.commandPermissions.set(
   guild.id,
   data.id,
   structuredClone(data.permissions) as RCommandPermissions[],
  );
 };

 const customBot = await client.util.getBotIdFromGuild(guild);
 if (customBot) cache();
 else if (data.applicationId === client.user?.id) cache();
};
