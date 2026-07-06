import { getChannelPerms, type RChannel, type RThread } from '@ayako/utility';
import {
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ChannelType,
 PermissionFlagsBits,
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { getChannelOption } from '../../../../Util/interactionOptions.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import type InfoPlugin from '../../Plugin.js';
import { chunkByLength, codeId, line, nameOf, timeOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

const channelEmote = (type: number) =>
 emotes.channelTypes[type as keyof typeof emotes.channelTypes] ?? emotes.message;

const baseLines = (t: Translator, channel: RChannel): string[] =>
 [
  line(emotes.info, t.base.t.name(), `\`${channel.name}\``),
  line(emotes.number, t.common.id(), codeId(channel.id)),
  line(
   channelEmote(channel.type),
   t.base.t.Type(),
   nameOf(t.base.channelTypes, channel.type, t.base.channelTypes.unknownChannel()),
  ),
  line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(channel.id), t.base)),
  channel.parent_id
   ? line(emotes.channelcategory, t.channel.parent(), `<#${channel.parent_id}>`)
   : null,
  'position' in channel && channel.position !== undefined
   ? line(emotes.number, t.channel.position(), `\`${channel.position}\``)
   : null,
  'nsfw' in channel
   ? line(emotes.warning, t.channel.nsfw(), yesNo(t.base, Boolean(channel.nsfw)))
   : null,
 ].filter((entry): entry is string => entry !== null);

const textLines = (t: Translator, channel: RChannel): string[] => {
 const lines: string[] = [];

 if ('rate_limit_per_user' in channel && channel.rate_limit_per_user) {
  lines.push(line(emotes.timer, t.channel.slowmode(), `\`${channel.rate_limit_per_user}s\``));
 }
 if ('default_auto_archive_duration' in channel && channel.default_auto_archive_duration) {
  lines.push(
   line(
    emotes.timer,
    t.channel.autoArchive(),
    nameOf(
     t.base.defaultAutoArchiveDuration,
     channel.default_auto_archive_duration,
     `${channel.default_auto_archive_duration}min`,
    ),
   ),
  );
 }

 return lines;
};

const voiceLines = (t: Translator, channel: RChannel): string[] => {
 const lines: string[] = [];

 if ('bitrate' in channel && channel.bitrate) {
  lines.push(line(emotes.channelvoice, t.channel.bitrate(), `\`${channel.bitrate / 1000}kbps\``));
 }
 if ('user_limit' in channel && channel.user_limit) {
  lines.push(line(emotes.member, t.channel.userLimit(), `\`${channel.user_limit}\``));
 }
 if ('rtc_region' in channel) {
  lines.push(
   line(
    emotes.channelvoice,
    t.channel.rtcRegion(),
    nameOf(t.base.regions, channel.rtc_region ?? 'null', String(channel.rtc_region)),
   ),
  );
 }
 if ('video_quality_mode' in channel && channel.video_quality_mode) {
  lines.push(
   line(
    emotes.image,
    t.channel.videoQuality(),
    nameOf(t.channel.videoQualityNames, channel.video_quality_mode, t.base.t.Unknown()),
   ),
  );
 }

 return lines;
};

const forumLines = (t: Translator, channel: RChannel): string[] => {
 const lines: string[] = [];

 if ('default_forum_layout' in channel && channel.default_forum_layout !== undefined) {
  lines.push(
   line(
    emotes.channelforum,
    t.channel.forumLayout(),
    nameOf(t.base.defaultForumLayout, channel.default_forum_layout, t.base.t.Unknown()),
   ),
  );
 }
 if ('default_sort_order' in channel && channel.default_sort_order !== null && channel.default_sort_order !== undefined) {
  lines.push(
   line(
    emotes.channelforum,
    t.channel.sortOrder(),
    nameOf(t.base.defaultSortOrder, channel.default_sort_order, t.base.t.Unknown()),
   ),
  );
 }
 if ('default_reaction_emoji' in channel && channel.default_reaction_emoji) {
  lines.push(
   line(
    emotes.emoji,
    t.channel.defaultReaction(),
    constants.formatters.getEmote({
     name: channel.default_reaction_emoji.emoji_name,
     id: channel.default_reaction_emoji.emoji_id ?? undefined,
    }) ?? t.base.t.Unknown(),
   ),
  );
 }
 if ('default_thread_rate_limit_per_user' in channel && channel.default_thread_rate_limit_per_user) {
  lines.push(
   line(emotes.timer, t.channel.threadSlowmode(), `\`${channel.default_thread_rate_limit_per_user}s\``),
  );
 }
 if ('available_tags' in channel && channel.available_tags?.length) {
  lines.push(
   line(
    emotes.fields,
    t.channel.tags(),
    channel.available_tags.map((tag) => `\`${tag.name}\``).join(', '),
   ),
  );
 }

 return lines;
};

const topicLines = async function (
 this: InfoPlugin,
 t: Translator,
 cmd: APIApplicationCommandInteraction,
 channel: RChannel,
): Promise<string[]> {
 if (!('topic' in channel) || !channel.topic) return [];

 const invokerId = cmd.member?.user.id;
 if (!invokerId || !cmd.guild_id) return [];

 const { allow } = await getChannelPerms.call(
  this.client.cache,
  cmd.guild_id,
  invokerId,
  channel.id,
 );
 const canView =
  (allow & PermissionFlagsBits.ViewChannel) === PermissionFlagsBits.ViewChannel;

 return [
  line(
   emotes.paragraph,
   t.base.t.Topic(),
   canView ? `\`\`\`${channel.topic}\`\`\`` : `\`${t.channel.topicHidden()}\``,
  ),
 ];
};

const childrenBlocks = async function (
 this: InfoPlugin,
 t: Translator,
 guildId: string,
 channel: RChannel,
): Promise<string[]> {
 if (channel.type !== ChannelType.GuildCategory) return [];

 const all = await this.client.cache.channels.getAll(guildId);
 const children = all
  .filter((child) => child.parent_id === channel.id)
  .sort((a, b) => ('position' in a && 'position' in b ? (a.position ?? 0) - (b.position ?? 0) : 0))
  .map((child) => `${textEmote(channelEmote(child.type))} <#${child.id}>`);

 if (!children.length) return [];
 return chunkByLength([`### ${t.channel.children()}`, ...children]);
};

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

 const channelId = getChannelOption(sub, InfoOption.Channel);
 const channel = channelId
  ? ((await this.client.cache.channels.get(channelId)) ??
    ((await this.client.cache.threads.get(channelId)) as RThread | RChannel | null))
  : null;
 if (!channel) {
  respondError.call(this, cmd, t.errors.channelNotFound());
  return;
 }

 const resolved = channel as RChannel;
 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(channelEmote(resolved.type))} ${t.channel.title()}\n${baseLines(t, resolved).join('\n')}`,
  ),
 );

 const detail = [
  ...textLines(t, resolved),
  ...voiceLines(t, resolved),
  ...forumLines(t, resolved),
  ...(await topicLines.call(this, t, cmd, resolved)),
 ];
 if (detail.length) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detail.join('\n')));
 }

 for (const block of await childrenBlocks.call(this, t, cmd.guild_id, resolved)) {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block));
 }

 respond.call(this, cmd, [container], getHide(sub));
}
