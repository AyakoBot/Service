import { RequestHandlerError } from '@ayako/api';
import type { RRole } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 ContainerBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 RoleFlags,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import { getRoleOption } from '../../../../Util/interactionOptions.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { InfoRoute, PermsTarget } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { codeId, line, timeOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

const identityLines = (emotes: EmoteSet, t: Translator, role: RRole): string[] =>
 [
  line(emotes.info, t.base.t.name(), `\`${role.name}\``),
  line(emotes.number, t.common.id(), codeId(role.id)),
  line(emotes.role, t.base.t.Role(), `<@&${role.id}>`),
  role.color
   ? line(emotes.palette, t.base.t.color(), `\`#${role.color.toString(16).padStart(6, '0')}\``)
   : null,
  line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(role.id), t.base)),
  role.unicode_emoji ? line(emotes.emoji, t.role.unicodeEmoji(), role.unicode_emoji) : null,
 ].filter((entry): entry is string => entry !== null);

const propertyLines = (
 emotes: EmoteSet,
 t: Translator,
 role: RRole,
 memberCount?: number,
): string[] =>
 [
  memberCount === undefined
   ? null
   : line(emotes.member, t.base.t.Members(), `\`${memberCount}\``),
  line(emotes.up, t.role.position(), `\`${role.position}\``),
  line(emotes.info, t.role.hoisted(), yesNo(emotes, t.base, role.hoist)),
  line(emotes.message, t.base.t.Mentionable(), yesNo(emotes, t.base, role.mentionable)),
  line(emotes.settings, t.role.managed(), yesNo(emotes, t.base, role.managed)),
  role.tags?.bot_id ? line(emotes.bot, t.base.t.Bot(), `<@${role.tags.bot_id}>`) : null,
  role.tags && 'premium_subscriber' in role.tags
   ? line(emotes.boost, t.role.boosterRole(), yesNo(emotes, t.base, true))
   : null,
  role.tags && 'available_for_purchase' in role.tags
   ? line(emotes.shop, t.role.purchasable(), yesNo(emotes, t.base, true))
   : null,
  role.tags && 'guild_connections' in role.tags
   ? line(emotes.link, t.role.guildConnections(), yesNo(emotes, t.base, true))
   : null,
  (role.flags & RoleFlags.InPrompt) === RoleFlags.InPrompt
   ? line(emotes.question, t.role.inPrompt(), yesNo(emotes, t.base, true))
   : null,
 ].filter((entry): entry is string => entry !== null);

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

 const roleId = getRoleOption(sub, InfoOption.Role);
 const role = roleId ? await this.client.cache.roles.get(roleId) : null;
 if (!role) {
  respondError.call(this, cmd, t.errors.roleNotFound());
  return;
 }

 const counts = await api.guilds.getRoleMemberCounts(cmd.guild_id, {
  origin: this.name,
  reason: 'Showing role member count',
 });
 const memberCount = counts instanceof RequestHandlerError ? undefined : counts[role.id];

 const container = new ContainerBuilder().setAccentColor(role.color || Colors.Info);

 const header = `## ${textEmote(emotes.role)} ${t.role.title()}\n${identityLines(
  emotes,
  t,
  role,
 ).join('\n')}`;
 if (role.icon_url) {
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(role.icon_url)),
  );
 } else {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
 }

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(propertyLines(emotes, t, role, memberCount).join('\n')),
 );

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.getRoute(InfoRoute.Members, role.id))
    .setLabel(t.role.viewMembers())
    .setEmoji(buttonEmoji(emotes.member)),
  ),
 );
 container.addActionRowComponents(
  new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
   new ChannelSelectMenuBuilder()
    .setCustomId(this.getRoute(InfoRoute.Perms, role.id, PermsTarget.Role))
    .setPlaceholder(t.role.viewChannelPerms())
    .setMinValues(1)
    .setMaxValues(1),
  ),
 );

 respond.call(this, cmd, [container], getHide(sub));
}
