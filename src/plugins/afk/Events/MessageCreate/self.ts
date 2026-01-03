import { EmbedBuilder } from '@discordjs/builders';

import { MessagePayload } from '../../../../classes/abstracts/MessagePayload.js';
import constants from '../../../../classes/Constants.js';
import { Colors } from '../../../../types/index.js';
import getPathFromError from '../../../../util/getPathFromError.js';
import isDeleteable from '../../../../util/isDeleteable.js';
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

 const afkBase = new AFKState(this.client.db, msg.author_id, msg.guild_id);
 const afk = await afkBase.get();
 if (!afk) return;
 if (Number(afk.since) > Date.now() - 60000) return;

 const embed = new EmbedBuilder()
  .setColor(Colors.Loading)
  .setDescription(t.t.removed({ time: constants.formatters.getTime(Number(afk.since)) }));

 const [m] = await new MessagePayload(this.client)
  .setChannels([{ id: msg.channel_id, guildId: msg.guild_id }])
  .setEmbeds([embed])
  .send();

 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + 10000),
  async () => {
   if (!m) return;
   if (!(await isDeleteable(m))) return;

   this.client.api.channels.deleteMessage(m.channel_id, m.id, { reason: t.t.removeReason() });
  },
 );

 afkBase.delete();
 deleteNick.call(this, t, msg.guild_id, msg.author_id);
}
