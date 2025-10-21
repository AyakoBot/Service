import * as Discord from 'discord.js';
import * as CT from '../../../Typings/Typings.js';
import type * as ModTypes from '../mod.js';

import error from '../error.js';
import errorCmd from '../errorCmd.js';
import errorMsg from '../errorMsg.js';

export default (
 cmd: ModTypes.CmdType,
 errs: DiscordAPIError | Error,
 language: CT.Language,
 message: ModTypes.ResponseMessage,
 guild: RGuild,
) => {
 if (cmd instanceof RMessage) {
  errorMsg(cmd, errs.message, language, message as RMessage);
  return;
 }

 if (!cmd) {
  error(guild, new Error(errs.message));
  return;
 }
 errorCmd(cmd, errs, language, message);
};
