import { getPathFromError, type RMessage } from '@ayako/utility';
import { EmbedBuilder } from '@discordjs/builders';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import AFKState from '../../AFKState.js';
import type AFKPlugin from '../../Plugin.js';

import { deleteNick } from './util.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
) {
 if (commandName === 'afk') return;

 const afkBase = new AFKState(this.client, msg.author_id, msg.guild_id);
 const afk = await afkBase.get();
 if (!afk) return;
 if (Number(afk.since) > Date.now() - 60000) return;

 const embed = new EmbedBuilder()
  .setColor(Colors.Loading)
  .setDescription(t.t.removed({ time: constants.formatters.getTime(Number(afk.since)) }));

 const [m] = await new MessagePayload(this.client)
  .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
  .setEmbeds([embed])
  .send();

 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + 10000),
  async () => {
   if (!m) return;

   (await this.client.getAPI(msg.guild_id)).channels.deleteMessage(m.channel_id, m.id, {
    reason: t.t.removeReason(),
   });
  },
 );

 afkBase.delete();
 deleteNick.call(this, t, msg.guild_id, msg.author_id);
}
