import { getPathFromError, type RMessage } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import AFKState from '../../AFKState.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';
import { deleteNick } from '../../Util/nick.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
) {
 if (commandName === AfkCommand.Afk) return;

 const afkBase = new AFKState(this.client, msg.author_id, msg.guild_id);
 const afk = await afkBase.get();
 if (!afk) return;
 if (Number(afk.since) > Date.now() - 60000) return;

 const [m] = await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'AFK user returned',
 })
  .setReply(msg.id)
  .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Loading)
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      t.t.removed({ time: constants.formatters.getTime(Number(afk.since)) }),
     ),
    )
    .toJSON(),
  ])
  .send();

 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + 10000),
  async () => {
   if (!m) return;

   (await this.client.getAPI(msg.guild_id)).channels.deleteMessage(m.channel_id, m.id, {
    reason: t.t.removeReason(),
    origin: this.name,
   });
  },
 );

 afkBase.delete();
 deleteNick.call(this, t, msg.guild_id, msg.author_id);
}
