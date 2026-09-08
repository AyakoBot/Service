import type { GatewayDispatchEvents } from '@discordjs/core';
import { MessageType } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import Afk from '../../Classes/Afk.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';
import getPrefix from '../../Util/getPrefix.js';

export default async function (
 this: AFKPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (!data.guild_id) return;
 if (data.author.bot) return;
 if (data.type !== MessageType.Default && data.type !== MessageType.Reply) return;

 const msg = this.client.cache.messages.apiToR(data, data.guild_id);
 if (!msg.author_id) return;

 const prefix = await getPrefix.call(this.client, msg);
 const commandName = prefix ? msg.content.slice(prefix.length).split(/\s+/)[0] : null;

 const afk = new Afk(this, msg.author_id, data.guild_id);
 if (commandName !== AfkCommand.Afk) afk.remove(msg);
 if (commandName !== AfkCommand.Unafk) Afk.notifyMentions(this, msg);
 if (commandName === AfkCommand.Afk) afk.setFromMessage(msg, prefix);
}
