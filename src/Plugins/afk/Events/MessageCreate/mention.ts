import type { RMessage } from '@ayako/utility';
import { EmbedBuilder } from '@discordjs/builders';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import AFKState from '../../AFKState.js';
import type AFKPlugin from '../../Plugin.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
) {
 if (commandName === 'unafk') return;
 if (!msg.mention_users?.length) return;
 if (msg.mention_users.length > 10) return;

 const mentionedIds = msg.mention_users.filter((id) => id !== msg.author_id);
 if (!mentionedIds.length) return;

 const afkStates = await Promise.all(
  mentionedIds.map(async (userId) => {
   const base = new AFKState(this.client.db, userId, msg.guild_id);
   return base.get();
  }),
 );

 const activeAfks = afkStates.filter((a): a is NonNullable<typeof a> => !!a);
 if (!activeAfks.length) return;

 const embeds: EmbedBuilder[] = activeAfks.map((afk) =>
  new EmbedBuilder().setColor(Colors.Loading).setDescription(
   t.t.isAFK({
    user: afk.userId,
    since: constants.formatters.getTime(Number(afk.since)),
    text: afk.reason ? `\n${afk.reason}` : '',
   }),
  ),
 );

 await new MessagePayload(this.client)
  .setChannels([{ id: msg.channel_id, guildId: msg.guild_id }])
  .setEmbeds(embeds)
  .send();
}
