import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 InteractionType,
 type APIInteraction,
} from '@discordjs/core';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import AFKState from '../../AFKState.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';
import { buildReasonEmbeds, getContent } from '../../Util/afkStatus.js';
import { setNick } from '../../Util/nick.js';

export default async function (this: AFKPlugin, cmd: APIInteraction) {
 if (cmd.type !== InteractionType.ApplicationCommand) return;
 if (cmd.data.name !== AfkCommand.Afk) return;
 if (!cmd.guild_id) return;
 if (!cmd.channel?.id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user?.id) return;
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 const member = cmd.member || (await this.client.cache.members.get(cmd.guild_id, user.id));

 const reason = cmd.data.options
  ?.filter((o) => o.type === ApplicationCommandOptionType.String)
  .find((o) => o.name === 'reason')?.value as string | undefined;

 const afkBase = new AFKState(this.client, user.id, cmd.guild_id);
 const afk = await afkBase.get();

 new MessagePayload(this.client, { origin: this.name, reason: 'Set AFK status' })
  .setSendTo([{ channel: cmd.channel.id, guildId: cmd.guild_id }])
  .setContent(await getContent.call(this, cmd.guild_id, afk, user.id))
  .setEmbeds(
   await buildReasonEmbeds.call(this, cmd.guild_id, reason, cmd.channel.id, member?.roles ?? []),
  )
  .reply(cmd);

 await afkBase.upsert(
  {
   userId: user.id,
   guildId: cmd.guild_id,
   reason,
   since: Date.now(),
  },
  { reason, since: Date.now() },
 );

 setNick.call(this, user.id, cmd.guild_id);
}
