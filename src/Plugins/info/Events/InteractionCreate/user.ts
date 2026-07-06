import { RequestHandlerError } from '@ayako/api';
import type { RMember, RUser } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 GuildMemberFlags,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import getUser from '../../../../Util/getUser.js';
import { getUserOption } from '../../../../Util/interactionOptions.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { InfoRoute, PermsTarget, RolesTarget } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { userBadgeLines } from '../../Util/badges.js';
import { codeId, line, timeOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

const newAccountMs = 7 * 24 * 60 * 60 * 1000;
const size4k = '?size=4096';

const memberFlagNames = (flags: number): string[] =>
 Object.entries(GuildMemberFlags)
  .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  .filter(([, bit]) => (flags & bit) === bit)
  .map(([name]) => name.replace(/([a-z])([A-Z])/g, '$1 $2'));

const identitySection = function (
 t: Translator,
 user: RUser,
 container: ContainerBuilder,
): void {
 const title = user.bot ? t.user.botTitle() : t.user.title();
 const header = [
  `## ${textEmote(user.bot ? emotes.bot : emotes.member)} ${title}`,
  `**${constants.formatters.user(user)}**${user.global_name ? ` (${user.global_name})` : ''}`,
  codeId(user.id),
 ].join('\n');

 if (user.avatar_url) {
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(`${user.avatar_url}${size4k}`)),
  );
  return;
 }
 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
};

const userDetailLines = (t: Translator, user: RUser): string[] => {
 const createdMs = snowflakeToMs(user.id);
 const lines = [line(emotes.calendar, t.base.t.Created(), timeOf(createdMs, t.base))];

 if (user.accent_color) {
  lines.push(
   line(emotes.palette, t.user.accentColor(), `\`#${user.accent_color.toString(16).padStart(6, '0')}\``),
  );
 }
 if (user.avatar_decoration_data) {
  lines.push(
   line(
    emotes.image,
    t.user.avatarDecoration(),
    `[${t.base.t.Open()}](${user.avatar_decoration_data.asset_url})`,
   ),
  );
 }

 return lines;
};

const memberDetailLines = (t: Translator, member: RMember): string[] => {
 const lines: string[] = [];

 if (member.nick) lines.push(line(emotes.edit, t.user.nickname(), `\`${member.nick}\``));
 lines.push(
  line(
   emotes.calendar,
   t.base.t.joinedAt(),
   timeOf(member.joined_at ? new Date(member.joined_at).getTime() : null, t.base),
  ),
 );
 if (member.premium_since) {
  lines.push(
   line(
    emotes.boost,
    t.user.boostingSince(),
    timeOf(new Date(member.premium_since).getTime(), t.base),
   ),
  );
 }

 const timedOut =
  Boolean(member.communication_disabled_until) &&
  new Date(member.communication_disabled_until as string).getTime() > Date.now();
 lines.push(
  `${line(emotes.timer, t.user.timeout(), yesNo(t.base, timedOut))}${
   timedOut
    ? ` (${constants.formatters.getTime(
       new Date(member.communication_disabled_until as string).getTime(),
      )})`
    : ''
  }`,
 );

 if (member.pending) lines.push(line(emotes.warning, t.user.pending(), yesNo(t.base, true)));

 const flagNames = memberFlagNames(member.flags ?? 0);
 if (flagNames.length) {
  lines.push(
   line(emotes.info, t.user.memberFlags(), flagNames.map((name) => `\`${name}\``).join(', ')),
  );
 }

 return lines;
};

const interactionRows = function (
 this: InfoPlugin,
 t: Translator,
 user: RUser,
 member: RMember | null,
 container: ContainerBuilder,
): void {
 if (member) {
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.Roles, RolesTarget.Member, user.id))
     .setLabel(t.user.viewRoles())
     .setEmoji(buttonEmoji(emotes.role))
     .setDisabled(!member.roles.length),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(InfoRoute.BasicPerms, user.id))
     .setLabel(t.user.viewBasicPerms())
     .setEmoji(buttonEmoji(emotes.lock)),
   ),
  );
  container.addActionRowComponents(
   new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
     .setCustomId(this.getRoute(InfoRoute.Perms, user.id, PermsTarget.User))
     .setPlaceholder(t.user.viewChannelPerms())
     .setMinValues(1)
     .setMaxValues(1),
   ),
  );
 }

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(`discord://-/users/${user.id}`)
    .setLabel(t.user.openDesktop()),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/users/${user.id}`)
    .setLabel(t.user.openBrowser()),
  ),
 );
};

export const buildUserContainer = function (
 this: InfoPlugin,
 t: Translator,
 user: RUser,
 member: RMember | null,
): ContainerBuilder {
 const createdMs = snowflakeToMs(user.id);
 const isNewAccount = createdMs !== null && Date.now() - createdMs < newAccountMs;

 const container = new ContainerBuilder().setAccentColor(
  user.accent_color ?? (isNewAccount ? Colors.Warning : Colors.Info),
 );

 identitySection(t, user, container);
 if (isNewAccount) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`-# ${textEmote(emotes.warning)} ${t.user.newAccount()}`),
  );
 }

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(userDetailLines(t, user).join('\n')),
 );

 const badges = userBadgeLines(t.base, user, member);
 if (badges.length) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`### ${t.base.t.Flags()}\n${badges.join('\n')}`),
  );
 }

 if (member) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `### ${t.user.memberTitle()}\n${memberDetailLines(t, member).join('\n')}`,
   ),
  );
  if (member.avatar_url && member.avatar_url !== user.avatar_url) {
   container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
     new MediaGalleryItemBuilder().setURL(`${member.avatar_url}${size4k}`),
    ),
   );
  }
 }

 if (user.banner_url) {
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(`${user.banner_url}${size4k}`),
   ),
  );
 }

 interactionRows.call(this, t, user, member, container);

 return container;
};

export const resolveUser = async function (
 this: InfoPlugin,
 userId: string,
): Promise<RUser | null> {
 const user = await getUser.call(this.client, userId);
 if (!user || user instanceof RequestHandlerError) return null;
 return user as RUser;
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const targetId =
  getUserOption(sub, InfoOption.User) ?? cmd.member?.user.id ?? cmd.user?.id ?? '';

 const user = await resolveUser.call(this, targetId);
 if (!user) {
  respondError.call(this, cmd, t.errors.userNotFound());
  return;
 }

 const member = cmd.guild_id
  ? await this.client.cache.members.get(cmd.guild_id, user.id)
  : null;

 respond.call(this, cmd, [buildUserContainer.call(this, t, user, member)], getHide(sub));
}

export const rerenderUser = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [targetId] = args;
 if (!targetId) return;

 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const user = await resolveUser.call(this, targetId);
 if (!user) return;

 const member = cmd.guild_id
  ? await this.client.cache.members.get(cmd.guild_id, user.id)
  : null;

 respond.call(this, cmd, [buildUserContainer.call(this, t, user, member)], true);
};
