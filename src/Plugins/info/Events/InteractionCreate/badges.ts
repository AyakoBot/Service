import type { RUser } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { badgeList, hasNitroIndicator } from '../../Util/badges.js';
import { getHide, respond, respondError } from '../../Util/respond.js';

const memberScanCap = 3000;

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const members = await this.client.cache.members.getAll(cmd.guild_id);
 const users = (
  await Promise.all(
   members.slice(0, memberScanCap).map((member) => this.client.cache.users.get(member.user_id)),
  )
 ).filter((user): user is RUser => Boolean(user));

 if (!users.length) {
  respondError.call(this, cmd, t.badges.none());
  return;
 }

 const counts = badgeList.map((badge) => ({
  badge,
  count: users.filter(
   (user) => (BigInt(user.public_flags ?? user.flags ?? 0) & badge.flag) === badge.flag,
  ).length,
 }));
 const nitroCount = users.filter((user) => !user.bot && hasNitroIndicator(user)).length;

 const lines = counts
  .filter(({ count }) => count > 0)
  .map(({ badge, count }) => `${textEmote(badge.emote)} \`${count}\` ${badge.label(t.base)}`);
 if (nitroCount) {
  lines.push(`${textEmote(emotes.userFlags.nitro)} \`${nitroCount}\` ${t.base.userFlags.Nitro()}+`);
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.badge)} ${t.badges.title()}`,
    lines.length ? lines.join('\n') : t.badges.none(),
    `-# ${t.badges.scanned({ count: String(users.length) })}`,
   ].join('\n'),
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
