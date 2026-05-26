import type { RMessage } from '@ayako/utility';
import { EmbedBuilder } from '@discordjs/builders';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import canUserExecuteCommand from '../../../../Util/canUserExecuteCommand.js';
import AFKState from '../../AFKState.js';
import type AFKPlugin from '../../Plugin.js';
import { getCensoredContent, getContent } from '../InteractionCreate/util.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 prefix: string | undefined,
) {
 if (commandName !== 'afk') return;
 if (!msg.guild_id) return;

 const canRunCommand = await canUserExecuteCommand.call(
  this.client,
  'afk',
  msg.guild_id,
  msg.author_id,
  msg.channel_id,
 );
 this.logger.debug(
  `[Plugin:${this.name}] canUserExecuteCommand response: ${canRunCommand.response}, debug: ${canRunCommand.debug}`,
 );

 if (!canRunCommand.response) {
  (await this.client.getAPI(msg.guild_id)).channels
   .addMessageReaction(
    msg.guild_id,
    msg.channel_id,
    msg.id,
    { main: '❌', alt: '❌' },
    {
     origin: this.name,
     reason: 'User does not have permission to execute the AFK command',
    },
   )
   .catch(() => null);
  return;
 }

 const member = await this.client.cache.members.get(msg.guild_id, msg.author_id);
 if (!member) return;

 const reason = msg.content.slice(commandName.length + (prefix || '').length).trim() || null;

 const afkBase = new AFKState(this.client, msg.author_id, msg.guild_id);
 const afk = await afkBase.get();

 new MessagePayload(this.client, { origin: this.name, reason: 'Set AFK status' })
  .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
  .setContent(await getContent.call(this, msg.guild_id, afk, msg.author_id))
  .setEmbeds(
   reason
    ? [
       new EmbedBuilder()
        .setColor(Colors.Loading)
        .setDescription(
         await getCensoredContent
          .call(this, msg.guild_id, reason, msg.channel_id, member?.roles ?? [])
          .then((r) => `-# ${r}`),
        ),
      ]
    : [],
  )
  .send();

 await afkBase.upsert(
  {
   userId: msg.author_id,
   guildId: msg.guild_id,
   since: Date.now(),
   reason,
  },
  { since: Date.now(), reason },
 );

 (await this.client.getAPI(msg.guild_id)).channels.deleteMessage(msg.channel_id, msg.id, {
  origin: this.name,
  reason: 'Clean up the command message after setting AFK status',
 });
}
