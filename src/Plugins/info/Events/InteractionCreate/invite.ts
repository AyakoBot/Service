import { RequestHandlerError } from '@ayako/api';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import { getStringOption } from '../../../../Util/interactionOptions.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import type InfoPlugin from '../../Plugin.js';
import { line, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError } from '../../Util/respond.js';

const invitePattern = /(?:discord(?:app)?\.com\/invite\/|discord\.gg\/)?([\w-]+)$/;

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const code = getStringOption(sub, InfoOption.Invite).trim().match(invitePattern)?.[1];
 if (!code) {
  respondError.call(this, cmd, t.errors.inviteNotFound());
  return;
 }

 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);
 const invite = await api.invites.get(
  code,
  { with_counts: true, with_expiration: true },
  { origin: this.name, reason: 'Fetching invite for info panel' },
 );
 if (!invite || invite instanceof RequestHandlerError) {
  respondError.call(this, cmd, t.errors.inviteNotFound());
  return;
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.invite)} ${t.invite.title()}`,
    line(
     emotes.link,
     t.base.t.Code(),
     `[discord.gg/${invite.code}](https://discord.gg/${invite.code})`,
    ),
    invite.guild_id
     ? line(emotes.info, t.base.t.Server(), `\`${invite.guild_id}\``)
     : null,
    invite.channel_id
     ? line(emotes.message, t.base.t.Channel(), `<#${invite.channel_id}>`)
     : null,
    invite.inviter_id
     ? line(emotes.member, t.base.t.Inviter(), `<@${invite.inviter_id}>`)
     : null,
    'uses' in invite && invite.uses !== undefined
     ? line(emotes.number, t.base.t.Uses(), `\`${invite.uses}\``)
     : null,
    'max_uses' in invite && invite.max_uses !== undefined
     ? line(emotes.number, t.invite.maxUses(), invite.max_uses ? `\`${invite.max_uses}\`` : '`∞`')
     : null,
    line(
     emotes.timer,
     t.invite.expiresAt(),
     invite.expires_at
      ? constants.formatters.getTime(new Date(invite.expires_at).getTime())
      : t.base.t.Never(),
    ),
    'temporary' in invite
     ? line(emotes.timer, t.invite.temporary(), yesNo(emotes, t.base, Boolean(invite.temporary)))
     : null,
    invite.approximate_member_count !== undefined
     ? line(emotes.member, t.invite.approxMembers(), `\`${invite.approximate_member_count}\``)
     : null,
    invite.approximate_presence_count !== undefined
     ? line(emotes.enabled, t.invite.approxOnline(), `\`${invite.approximate_presence_count}\``)
     : null,
   ]
    .filter((entry): entry is string => entry !== null)
    .join('\n'),
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
