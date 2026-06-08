import { getPathFromError, type RMessage } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import AFKState from '../../AFKState.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 t: Awaited<ReturnType<AFKPlugin['t']>>,
) {
 if (commandName === AfkCommand.Unafk) return;
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

 const [m] = await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'A mentioned user is AFK',
 })
  .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
  .setReply(msg.id)
  .setFlags(MessageFlags.IsComponentsV2)
  .setAllowedMentionsRepliedUser(true)
  .setComponents(
   activeAfks.map((afk) =>
    new ContainerBuilder()
     .setAccentColor(Colors.Loading)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       t.t.isAFK({
        user: afk.userId,
        since: constants.formatters.getTime(Number(afk.since)),
        text: afk.reason ? `\n> -# ${afk.reason}` : ' ',
       }),
      ),
     )
     .toJSON(),
   ),
  )
  .send();

 this.client.jobCache.createJob(
  getPathFromError(new Error()),
  new Date(Date.now() + 10000),
  async () => {
   if (!m) return;

   (await this.client.getAPI(msg.guild_id)).channels.deleteMessage(m.channel_id, m.id, {
    reason: t.t.replyReason(),
    origin: this.name,
   });
  },
 );
}
