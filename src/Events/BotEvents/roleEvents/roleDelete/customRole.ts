import * as Discord from 'discord.js';

export default async (role: RRole) => {
 role.client.util.DataBase.customroles
  .deleteMany({
   where: {
    roleid: role.id,
   },
  })
  .then();
};
