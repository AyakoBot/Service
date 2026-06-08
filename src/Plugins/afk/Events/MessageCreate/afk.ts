import type { RMessage } from '@ayako/utility';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import canUserExecuteCommand from '../../../../Util/canUserExecuteCommand.js';
import AFKState from '../../AFKState.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';
import { buildReasonEmbeds, getContent } from '../../Util/afkStatus.js';
import { setNick } from '../../Util/nick.js';

export default async function (
 this: AFKPlugin,
 msg: RMessage,
 commandName: string | null,
 prefix: string | undefined,
) {
 if (commandName !== AfkCommand.Afk) return;
 if (!msg.guild_id) return;

 const canRunCommand = await canUserExecuteCommand.call(
  this.client,
  AfkCommand.Afk,
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
   await buildReasonEmbeds.call(this, msg.guild_id, reason, msg.channel_id, member?.roles ?? []),
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

 setNick.call(this, msg.author_id, msg.guild_id);

 (await this.client.getAPI(msg.guild_id)).channels.deleteMessage(msg.channel_id, msg.id, {
  origin: this.name,
  reason: 'Clean up the command message after setting AFK status',
 });
}
