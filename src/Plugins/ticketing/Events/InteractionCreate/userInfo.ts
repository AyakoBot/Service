import { RequestHandlerError } from '@ayako/api';
import {
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import getUser from '../../../../Util/getUser.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToDate.js';
import type TicketPlugin from '../../Plugin.js';
import { ticketCounts } from '../../Util/ticketCounts.js';

const roleLineCap = 1500;
const newAccountMS = 7 * 24 * 60 * 60 * 1000;

const formatRoles = (roleIds: string[]): string => {
 if (!roleIds.length) return '—';

 const mentions: string[] = [];
 let length = 0;
 for (const roleId of roleIds) {
  const mention = `<@&${roleId}>`;
  if (length + mention.length + 1 > roleLineCap) {
   mentions.push('…');
   break;
  }
  mentions.push(mention);
  length += mention.length + 1;
 }

 return mentions.join(' ');
};

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const [targetId] = args;
 if (!targetId) return;

 const t = await this.t(cmd.guild_id);

 const user = await getUser
  .call(this.client, targetId)
  .then((r) => (r instanceof RequestHandlerError ? null : r));
 const member = await this.client.cache.members.get(cmd.guild_id, targetId);
 const counts = await ticketCounts.call(this.client, cmd.guild_id, targetId);

 const createdMs = snowflakeToMs(targetId);
 const isNewAccount = createdMs !== null && Date.now() - createdMs < newAccountMS;

 const container = new ContainerBuilder().setAccentColor(
  isNewAccount ? Colors.Warning : Colors.Info,
 );

 const name = user
  ? constants.formatters.user(user)
  : t.base.t.unknownUser();
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`**${name}**\n\`${targetId}\``),
 );

 if (isNewAccount) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`-# ${t.newAccount()}`),
  );
 }

 const detailLines = [
  `${t.base.t.Created()}: ${
   createdMs !== null ? constants.formatters.getTime(createdMs) : t.base.t.Unknown()
  }`,
  `${t.base.t.joinedAt()}: ${
   member?.joined_at
    ? constants.formatters.getTime(new Date(member.joined_at).getTime())
    : t.base.t.Unknown()
  }`,
 ];
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(detailLines.join('\n')),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `**${t.base.t.Roles()}**\n${formatRoles(member?.roles ?? [])}`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `**${t.ticketHistory()}**\n${t.ticketHistoryCounts({
    total: String(counts.total),
    open: String(counts.open),
    closed: String(counts.closed),
   })}`,
  ),
 );

 await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Showing ticket user-info panel',
 })
  .setAllowedMentionsUsers([])
  .setAllowedMentionsRoles([])
  .setComponents([container.toJSON()])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .reply(cmd);
}
