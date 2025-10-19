import * as Discord from 'discord.js';
import * as CT from '../../../Typings/Typings.js';

import objectEmotes from '../emotes.js';
import { guild as getBotIdFromGuild } from '../getBotIdFrom.js';
import type * as ModTypes from '../mod.js';
import { request } from '../requestHandler.js';

export default async (
 cmd: ModTypes.CmdType,
 client: RUser,
 message: ModTypes.ResponseMessage,
 language: CT.Language,
 options: CT.BaseOptions,
 type: CT.ModTypes,
) => {
 if (options.target.id !== (cmd?.inGuild() ? await getBotIdFromGuild(cmd.guild) : client.id)) {
  return false;
 }
 if (!message) return true;

 const { me } = language.mod.execution[type as keyof CT.Language['mod']['execution']];

 const payload = {
  embeds: [
   {
    color: CT.Colors.Danger,
    author: {
     name: language.t.error,
     icon_url: objectEmotes.warning.link,
    },
    description: me,
   },
  ],
 };

 if (!(cmd instanceof RMessage) && cmd) cmd.editReply(payload);
 else if (message instanceof RMessage) request.channels.editMsg(message, payload);

 return true;
};
