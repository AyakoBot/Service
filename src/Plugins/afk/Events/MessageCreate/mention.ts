import type { RMessage } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';

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
   const base = new AFKState(this.client, userId, msg.guild_id);
   return base.get();
  }),
 );

 const activeAfks = afkStates.filter((a): a is NonNullable<typeof a> => !!a);
 if (!activeAfks.length) return;

 await new MessagePayload(this.client, { origin: this.name, reason: 'A mentioned user is AFK' })
  .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
  .setComponents(
   activeAfks.map((afk) =>
    new ContainerBuilder()
     .setAccentColor(Colors.Loading)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       t.t.isAFK({
        user: afk.userId,
        since: constants.formatters.getTime(Number(afk.since)),
        text: afk.reason ? `\n${afk.reason}` : '',
       }),
      ),
     )
     .toJSON(),
   ),
  )
  .send();
}
