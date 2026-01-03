import { EmbedBuilder } from '@discordjs/builders';

import { MessagePayload } from '../../../../classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../types/index.js';
import AFKState from '../../AFKState.js';
import type AFKPlugin from '../../Plugin.js';
import { getCensoredContent, getContent } from '../InteractionCreate/util.js';

export default async function (this: AFKPlugin, msg: RMessage, commandName: string | null) {
 if (commandName !== 'afk') return;
 if (!msg.guild_id) return;

 const member = await this.client.cache.members.get(msg.guild_id, msg.author_id);
 if (!member) return;

 const reason = msg.content.slice(commandName.length).trim() || null;

 const embed = new EmbedBuilder()
  .setColor(Colors.Loading)
  .setDescription(
   await getCensoredContent.call(
    this,
    msg.guild_id,
    reason ?? '',
    msg.channel_id,
    member?.roles ?? [],
   ),
  );

 const afkBase = new AFKState(this.client.db, msg.author_id, msg.guild_id);
 const afk = await afkBase.get();

 new MessagePayload(this.client)
  .setContent(await getContent.call(this, msg.guild_id, afk, msg.author_id))
  .setChannels([{ id: msg.channel_id, guildId: msg.guild_id }])
  .addEmbeds(embed)
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

 this.client.api.channels.deleteMessage(msg.channel_id, msg.id);
}
