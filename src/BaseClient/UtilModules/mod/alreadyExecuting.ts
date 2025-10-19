import * as Discord from 'discord.js';
import * as Jobs from 'node-schedule';
import * as CT from '../../../Typings/Typings.js';

import { getLanguage } from '../getLanguage.js';
import getPathFromError from '../getPathFromError.js';
import isDeleteable from '../isDeleteable.js';
import type * as ModTypes from '../mod.js';
import replyCmd from '../replyCmd.js';
import replyMsg from '../replyMsg.js';
import { request } from '../requestHandler.js';

export default async (
 cmd: ModTypes.CmdType,
 executor: RUser,
 client: Discord.Client,
 replyMessage: ModTypes.ResponseMessage,
) => {
 if (!cmd) return;
 if (executor.id === client.user?.id) return;

 const language = await getLanguage(cmd.guildId);

 const payload = {
  embeds: [
   {
    color: CT.Colors.Danger,
    description: language.mod.alreadyExecuting,
   },
  ],
 };

 const updateExistingResponse = () => {
  if (!replyMessage) return undefined;

  if (replyMessage instanceof RMessage) {
   request.channels.editMessage(
    replyMessage.guild,
    replyMessage.channelId,
    replyMessage.id,
    payload,
   );
   return replyMessage;
  }

  (cmd as Discord.ChatInputCommandInteraction).editReply({ ...payload, message: replyMessage.id });
  return replyMessage;
 };

 const reply = replyMessage
  ? updateExistingResponse()
  : await (cmd instanceof RMessage ? replyMsg(cmd, payload) : replyCmd(cmd, payload));

 if (!reply) return;
 if (!(reply instanceof RMessage)) return;

 Jobs.scheduleJob(getPathFromError(new Error()), new Date(Date.now() + 10000), async () => {
  if (await isDeleteable(reply)) request.channels.deleteMessage(reply);
 });
};
