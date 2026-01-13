import { EmbedBuilder } from '@discordjs/builders';
import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 InteractionType,
 type APIInteraction,
} from '@discordjs/core';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import AFKState from '../../AFKState.js';
import type AFKPlugin from '../../Plugin.js';

import { getCensoredContent, getContent } from './util.js';

export default async function (this: AFKPlugin, cmd: APIInteraction) {
 if (cmd.type !== InteractionType.ApplicationCommand) return;
 if (!cmd.guild_id) return;
 if (!cmd.channel?.id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user?.id) return;
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 const member = cmd.member || (await this.client.cache.members.get(cmd.guild_id, user.id));

 const reason = cmd.data.options
  ?.filter((o) => o.type === ApplicationCommandOptionType.String)
  .find((o) => o.name === 'reason')?.value as string | undefined;

 const afkBase = new AFKState(this.client.db, user.id, cmd.guild_id);
 const afk = await afkBase.get();

 const embed = new EmbedBuilder()
  .setColor(Colors.Loading)
  .setDescription(
   await getCensoredContent.call(
    this,
    cmd.guild_id,
    reason ?? '',
    cmd.channel.id,
    member?.roles ?? [],
   ),
  );

 new MessagePayload(this.client)
  .setContent(await getContent.call(this, cmd.guild_id, afk, user.id))
  .setChannels([{ id: cmd.channel.id, guildId: cmd.guild_id }])
  .addEmbeds(embed)
  .send();

 await afkBase.upsert(
  {
   userId: user.id,
   guildId: cmd.guild_id,
   reason,
   since: Date.now(),
  },
  { reason, since: Date.now() },
 );
}
