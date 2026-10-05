import { RequestHandlerError } from '@ayako/api';
import type { CreateMessageOptions } from '@discordjs/core';
import type { APIMessage } from 'discord-api-types/v10';

import type AFKPlugin from '../Plugin.js';

export const postNotice = async function (
 this: AFKPlugin,
 guildId: string,
 channelId: string,
 body: CreateMessageOptions,
 reason: string,
): Promise<APIMessage | undefined> {
 const sent = await (await this.getAPI(guildId)).channels.createMessage(channelId, body, {
  origin: this.name,
  reason,
 });

 if (!(sent instanceof RequestHandlerError)) return sent;

 this.nonFatalError(sent, 'postNotice');
 return undefined;
};
