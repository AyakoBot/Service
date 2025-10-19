import * as Discord from 'discord.js';
import * as CT from '../../../Typings/Typings.js';

import objectEmotes from '../emotes.js';
import type * as ModTypes from '../mod.js';
import { request } from '../requestHandler.js';

export default async (
 cmd: ModTypes.CmdType,
 target: RMember,
 executor: RMember,
 message: ModTypes.ResponseMessage,
 language: CT.Language,
 type: CT.ModTypes,
): Promise<boolean> => {
 if (executor.id === executor.guild.ownerId) return true;
 if (target.roles.highest.position < executor.roles.highest.position) return true;
 if (!message) return false;

 const payload = {
  embeds: [
   {
    color: CT.Colors.Danger,
    author: {
     icon_url: objectEmotes.warning.link,
     name: language.t.error,
    },
    description: language.mod.execution[type as keyof CT.Language['mod']['execution']].youNoPerms,
   },
  ],
 };

 if (!(cmd instanceof RMessage) && cmd) cmd.editReply(payload);
 else if (message instanceof RMessage) request.channels.editMsg(message, payload);

 return false;
};
