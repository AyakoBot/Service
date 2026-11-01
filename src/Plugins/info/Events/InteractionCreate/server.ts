import { GuildCache, type RGuild } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
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
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIInvite,
 type APIInviteGuild,
} from 'discord-api-types/v10';

import type { EmoteSet } from '../../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../../Types/index.js';
import { codeId, line, nameOf, timeOf, yesNo } from '../../../../Util/fmt.js';
import { getStringOption } from '../../../../Util/interactionOptions.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import { InfoRoute, RolesTarget } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import inviteCode from '../../Util/inviteCode.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

type GuildIdentity = Pick<RGuild, 'id' | 'name' | 'description' | 'vanity_url_code'> & {
 owner_id?: string;
};

type GuildInvite = APIInvite & { guild: APIInviteGuild };

const hasGuild = (invite: APIInvite | null): invite is GuildInvite => Boolean(invite?.guild);

const acronym = (name: string): string =>
 name
  .replace(/'s /g, ' ')
  .replace(/\w+/g, (word) => word[0])
  .replace(/\s/g, '');

const channelLine = (
 emotes: EmoteSet,
 label: string,
 channelId: string | null | undefined,
): string | null => (channelId ? line(emotes.message, label, `<#${channelId}>`) : null);

const identityLines = (emotes: EmoteSet, t: Translator, guild: GuildIdentity): string[] =>
 [
  line(emotes.info, t.base.t.name(), `\`${guild.name}\``),
  line(emotes.heading, t.server.acronym(), `\`${acronym(guild.name)}\``),
  line(emotes.number, t.common.id(), codeId(guild.id)),
  line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(guild.id), t.base)),
  guild.owner_id ? line(emotes.crown, t.server.owner(), `<@${guild.owner_id}>`) : null,
  guild.description
   ? line(emotes.paragraph, t.base.t.Description(), `\`\`\`${guild.description}\`\`\``)
   : null,
  guild.vanity_url_code
   ? line(
      emotes.link,
      t.server.vanity(),
      `[discord.gg/${guild.vanity_url_code}](https://discord.gg/${guild.vanity_url_code})`,
     )
   : null,
 ].filter((entry): entry is string => entry !== null);

const channelLines = (emotes: EmoteSet, t: Translator, guild: RGuild): string[] =>
 [
  channelLine(emotes, t.server.systemChannel(), guild.system_channel_id),
  channelLine(emotes, t.server.rulesChannel(), guild.rules_channel_id),
  channelLine(emotes, t.server.publicUpdatesChannel(), guild.public_updates_channel_id),
  channelLine(emotes, t.server.safetyAlertsChannel(), guild.safety_alerts_channel_id),
  channelLine(emotes, t.server.widgetChannel(), guild.widget_channel_id),
  channelLine(emotes, t.server.afkChannel(), guild.afk_channel_id),
  guild.afk_channel_id
   ? line(emotes.timer, t.server.afkTimeout(), `\`${guild.afk_timeout / 60}min\``)
   : null,
 ].filter((entry): entry is string => entry !== null);

const statLines = async function (
 this: InfoPlugin,
 emotes: EmoteSet,
 t: Translator,
 guild: RGuild,
): Promise<string[]> {
 const [channels, automods, events] = await Promise.all([
  this.client.cache.channels.getAll(guild.id),
  this.client.cache.automods.getAll(guild.id),
  this.client.cache.events.getAll(guild.id),
 ]);

 // eslint-disable-next-line @typescript-eslint/naming-convention
 const memberCount = (guild as { member_count?: number }).member_count;

 return [
  memberCount === undefined
   ? null
   : line(
      emotes.member,
      t.base.t.Members(),
      `\`${memberCount}\`${guild.max_members ? ` / \`${guild.max_members}\`` : ''}`,
     ),
  line(emotes.message, t.base.t.Channels(), `\`${channels.length}\``),
  line(emotes.role, t.base.t.Roles(), `\`${guild.roles.length}\``),
  line(emotes.emoji, t.base.t.Emoji(), `\`${guild.emojis.length}\``),
  line(emotes.image, t.base.t.Sticker(), `\`${guild.stickers.length}\``),
  line(emotes.automod, t.base.t.AutoModRule(), `\`${automods.length}\``),
  line(emotes.calendar, t.base.t.ScheduledEvent(), `\`${events.length}\``),
  line(
   emotes.boost,
   t.server.boosts(),
   `\`${guild.premium_subscription_count ?? 0}\` (${t.base.t.Tier()} \`${guild.premium_tier}\`)`,
  ),
 ].filter((entry): entry is string => entry !== null);
};

const otherLines = (emotes: EmoteSet, t: Translator, guild: RGuild): string[] => [
 line(
  emotes.message,
  t.server.notifications(),
  nameOf(t.server.notificationNames, guild.default_message_notifications, t.base.t.Unknown()),
 ),
 line(
  emotes.warning,
  t.server.contentFilter(),
  nameOf(t.server.contentFilterNames, guild.explicit_content_filter, t.base.t.Unknown()),
 ),
 line(emotes.lock, t.server.mfaLevel(), yesNo(emotes, t.base, guild.mfa_level === 1)),
 line(
  emotes.warning,
  t.server.nsfwLevel(),
  nameOf(t.server.nsfwLevelNames, guild.nsfw_level, t.base.t.Unknown()),
 ),
 line(
  emotes.shield,
  t.server.verificationLevel(),
  nameOf(t.server.verificationLevelNames, guild.verification_level, t.base.t.Unknown()),
 ),
 line(
  emotes.globe,
  t.server.locale(),
  nameOf(t.base.regions, guild.preferred_locale, guild.preferred_locale),
 ),
];

const inviteStatLines = (emotes: EmoteSet, t: Translator, invite: GuildInvite): string[] =>
 [
  invite.approximate_member_count === undefined
   ? null
   : line(emotes.member, t.invite.approxMembers(), `\`${invite.approximate_member_count}\``),
  invite.approximate_presence_count === undefined
   ? null
   : line(emotes.enabled, t.invite.approxOnline(), `\`${invite.approximate_presence_count}\``),
  line(emotes.boost, t.server.boosts(), `\`${invite.guild.premium_subscription_count ?? 0}\``),
 ].filter((entry): entry is string => entry !== null);

const inviteOtherLines = (emotes: EmoteSet, t: Translator, guild: APIInviteGuild): string[] => [
 line(
  emotes.warning,
  t.server.nsfwLevel(),
  nameOf(t.server.nsfwLevelNames, guild.nsfw_level, t.base.t.Unknown()),
 ),
 line(
  emotes.shield,
  t.server.verificationLevel(),
  nameOf(t.server.verificationLevelNames, guild.verification_level, t.base.t.Unknown()),
 ),
];

const headerContainer = (header: string, iconUrl: string | null): ContainerBuilder => {
 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 const text = new TextDisplayBuilder().setContent(header);
 if (!iconUrl) return container.addTextDisplayComponents(text);

 return container.addSectionComponents(
  new SectionBuilder()
   .addTextDisplayComponents(text)
   .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)),
 );
};

const addBlock = (container: ContainerBuilder, content: string): ContainerBuilder =>
 container
  .addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  )
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

const addBanner = (container: ContainerBuilder, bannerUrl: string | null): ContainerBuilder =>
 bannerUrl
  ? container.addMediaGalleryComponents(
     new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl)),
    )
  : container;

const header = (emotes: EmoteSet, t: Translator, guild: GuildIdentity): string =>
 `## ${textEmote(emotes.server)} ${t.server.title()}\n${identityLines(emotes, t, guild).join('\n')}`;

const guildPanel = async function (
 this: InfoPlugin,
 emotes: EmoteSet,
 t: Translator,
 guild: RGuild,
): Promise<ContainerBuilder> {
 const container = headerContainer(header(emotes, t, guild), guild.icon_url);

 const channels = channelLines(emotes, t, guild);
 if (channels.length) addBlock(container, `### ${t.base.t.Channels()}\n${channels.join('\n')}`);

 const stats = await statLines.call(this, emotes, t, guild);
 addBlock(container, `### ${t.server.statsTitle()}\n${stats.join('\n')}`);
 addBlock(container, `### ${t.server.otherTitle()}\n${otherLines(emotes, t, guild).join('\n')}`);
 addBanner(container, guild.banner_url);

 return container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.getRoute(InfoRoute.Features, guild.id))
    .setLabel(t.server.viewFeatures())
    .setEmoji(buttonEmoji(emotes.settings)),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(this.getRoute(InfoRoute.Roles, RolesTarget.Server, guild.id))
    .setLabel(t.server.viewRoles())
    .setEmoji(buttonEmoji(emotes.role)),
  ),
 );
};

const invitePanel = (emotes: EmoteSet, t: Translator, invite: GuildInvite): ContainerBuilder => {
 const { guild } = invite;
 const iconUrl = guild.icon ? GuildCache.getIconUrl(guild.icon, guild.id) : null;
 const bannerUrl = guild.banner ? GuildCache.getBannerUrl(guild.banner, guild.id) : null;
 const container = headerContainer(header(emotes, t, guild), iconUrl);

 const stats = inviteStatLines(emotes, t, invite);
 addBlock(container, `### ${t.server.statsTitle()}\n${stats.join('\n')}`);
 addBlock(
  container,
  `### ${t.server.otherTitle()}\n${inviteOtherLines(emotes, t, guild).join('\n')}`,
 );

 return addBanner(container, bannerUrl);
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);

 const code = inviteCode(getStringOption(sub, InfoOption.Invite));
 const invite = code
  ? await api.invites.base.get(code, { with_counts: true }).catch(() => null)
  : null;
 if (code && !hasGuild(invite)) {
  respondError.call(this, cmd, t.errors.inviteNotFound());
  return;
 }

 const guildId = invite?.guild?.id || getStringOption(sub, InfoOption.ServerId) || cmd.guild_id;
 if (!guildId) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const guild = await this.client.cache.guilds.get(guildId);
 if (guild) {
  respond.call(this, cmd, [await guildPanel.call(this, emotes, t, guild)], getHide(sub));
  return;
 }

 if (hasGuild(invite)) {
  respond.call(this, cmd, [invitePanel(emotes, t, invite)], getHide(sub));
  return;
 }

 respondError.call(this, cmd, t.errors.serverNotFound());
}
