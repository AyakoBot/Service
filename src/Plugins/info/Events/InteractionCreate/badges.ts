import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { badgeList, hasNitroIndicator } from '../../Util/badges.js';
import { getHide, respond, respondError } from '../../Util/respond.js';

const scanPage = 2000;

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

 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const counts = new Map<bigint, number>(badgeList.map((badge) => [badge.flag, 0]));
 let nitroCount = 0;
 let scanned = 0;
 let cursor = '0';

 do {
  const [next, fields] = (await this.client.cache.cacheDb.call(
   'HSCAN',
   this.client.cache.members.keystore(cmd.guild_id),
   cursor,
   'COUNT',
   scanPage,
   'NOVALUES',
  )) as [string, string[]];
  cursor = next;

  const users = await Promise.all(
   fields.map((field) => this.client.cache.users.get(field.slice(field.lastIndexOf(':') + 1))),
  );

  for (const user of users) {
   if (!user) continue;

   scanned += 1;
   const flags = BigInt(user.public_flags ?? user.flags ?? 0);
   for (const badge of badgeList) {
    if ((flags & badge.flag) !== badge.flag) continue;
    counts.set(badge.flag, (counts.get(badge.flag) ?? 0) + 1);
   }

   if (!user.bot && hasNitroIndicator(user)) nitroCount += 1;
  }
 } while (cursor !== '0');

 if (!scanned) {
  respondError.call(this, cmd, t.badges.none());
  return;
 }

 const lines = badgeList
  .map((badge) => ({ badge, count: counts.get(badge.flag) ?? 0 }))
  .filter(({ count }) => count > 0)
  .map(
   ({ badge, count }) =>
    `${textEmote(emotes.get(badge.emote))} \`${count}\` ${badge.label(t.base)}`,
  );
 if (nitroCount) {
  lines.push(`${textEmote(emotes.userFlags.nitro)} \`${nitroCount}\` ${t.base.userFlags.Nitro()}+`);
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   [
    `## ${textEmote(emotes.badge)} ${t.badges.title()}`,
    lines.length ? lines.join('\n') : t.badges.none(),
    `-# ${t.badges.scanned({ count: String(scanned) })}`,
   ].join('\n'),
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
