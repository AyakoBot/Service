import { RequestHandlerError } from '@ayako/api';
import type { AfkState as AfkStateRow } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 EmbedBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ApplicationCommandOptionType,
 ButtonStyle,
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import { Colors } from '../../../Types/index.js';
import type { WhereUnique } from '../../../Types/prisma.js';
import { getCensoredContent } from '../../../Util/censorContent.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import getUser from '../../../Util/getUser.js';
import { AfkCommand, AfkOption, AfkRoute, NickSkip } from '../Enums.js';
import type AFKPlugin from '../Plugin.js';
import canUserExecuteCommand from '../Util/canUserExecuteCommand.js';
import { afkSuffixOf, taggedNick, untaggedNick } from '../Util/nick.js';
import { pingPreview } from '../Util/pingPreview.js';
import { postNotice } from '../Util/postNotice.js';
import { scheduleNoticeDelete } from '../Util/scheduleNoticeDelete.js';
import { flatten, messageLink } from '../Util/text.js';

import type { AfkPing } from './AfkTracker.js';

const defaultMaxLetters = 250;
const returnGraceMs = 60000;
const returnNoticeLifetimeMs = 30000;
const maxCandidates = 10;
const shownPings = 10;

type Translator = Awaited<ReturnType<AFKPlugin['t']>>;

const nickNotes: Record<NickSkip, (t: Translator) => string> = {
 [NickSkip.TooLong]: (t) => t.t.nickTooLong(),
 [NickSkip.Owner]: (t) => t.t.nickOwner(),
 [NickSkip.Failed]: (t) => t.t.nickFailed(),
};

const withNote = (content: string, t: Translator, skip: NickSkip | null) =>
 skip ? `${content}\n${nickNotes[skip](t)}` : content;

export default class Afk {
 plugin: AFKPlugin;
 userId: string;
 guild: string;
 private client: Client;
 private where: WhereUnique<'afkState'>;

 constructor(plugin: AFKPlugin, userId: string, guildId: string) {
  this.client = plugin.client;
  this.where = { user_guild: { user: userId, guild: guildId } };
  this.plugin = plugin;
  this.userId = userId;
  this.guild = guildId;
 }

 static async notifyMentions(plugin: AFKPlugin, msg: RMessage) {
  const replied = msg.referenced_message?.author.id;
  const candidates = [...new Set([...msg.mention_users, ...(replied ? [replied] : [])])].filter(
   (id) => id !== msg.author_id,
  );
  if (!candidates.length || candidates.length > maxCandidates) return;

  const afkStates = (
   await Promise.all(candidates.map((userId) => new Afk(plugin, userId, msg.guild_id).get()))
  ).filter((afk): afk is AfkStateRow => !!afk);
  if (!afkStates.length) return;

  const preview = await pingPreview.call(plugin, msg);
  await Promise.all(
   afkStates.map((afk) => plugin.tracker.recordPing(msg.guild_id, afk.user, msg, preview)),
  );

  const claimed = await Promise.all(
   afkStates.map((afk) => plugin.tracker.claimNotice(msg.guild_id, afk.user)),
  );
  const noticed = afkStates.filter((_, index) => claimed[index]);
  if (!noticed.length) return;

  const t = await plugin.t(msg.guild_id);
  const containers = await Promise.all(
   noticed.map(async (afk) => {
    const member = await plugin.client.cache.members.get(msg.guild_id, afk.user);
    const reason = afk.reason
     ? await getCensoredContent.call(
        plugin,
        msg.guild_id,
        flatten(afk.reason),
        msg.channel_id,
        member?.roles ?? [],
       )
     : null;

    return new ContainerBuilder()
     .setAccentColor(Colors.Loading)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       t.t.isAFK({
        user: afk.user,
        since: constants.formatters.getTime(Number(afk.since)),
        text: reason ? `\n> -# ${reason}` : ' ',
       }),
      ),
     )
     .toJSON();
   }),
  );

  const body = new MessagePayload(plugin.client, {
   origin: plugin.name,
   reason: 'A mentioned user is AFK',
  })
   .setReply(msg.id)
   .setFlags(MessageFlags.IsComponentsV2)
   .setAllowedMentionsRepliedUser(true)
   .setComponents(containers)
   .getAPIPayload();

  const notice = await postNotice.call(
   plugin,
   msg.guild_id,
   msg.channel_id,
   body,
   t.t.replyReason(),
  );
  scheduleNoticeDelete.call(plugin, notice, msg.guild_id, t.t.replyReason());
 }

 get(): Promise<AfkStateRow | null> {
  return this.client.db.client.afkState.findUnique({ where: this.where });
 }

 private t() {
  return this.plugin.t(this.guild);
 }

 async set(cmd: APIChatInputApplicationCommandInteraction) {
  if (!cmd.channel.id) return;

  const t = await this.t();
  const member = cmd.member || (await this.client.cache.members.get(this.guild, this.userId));
  const reason = await this.clampReason(
   cmd.data.options
    ?.filter((o) => o.type === ApplicationCommandOptionType.String)
    .find((o) => o.name === AfkOption.Reason)?.value as string | undefined,
  );
  const content = await this.confirmation(t, await this.get());

  await new MessagePayload(this.client, { origin: this.plugin.name, reason: 'Set AFK status' })
   .setSendTo([{ channel: cmd.channel.id, guildId: this.guild }])
   .setContent(content)
   .setEmbeds(await this.reasonEmbeds(reason, cmd.channel.id, member?.roles ?? []))
   .reply(cmd);

  await this.save(reason);

  const skip = await this.setNick();
  if (!skip) return;

  const res = await this.client
   .getBaseAPI()
   .webhooks.editMessage(
    cmd.application_id,
    cmd.token,
    '@original',
    { content: withNote(content, t, skip) },
    { origin: this.plugin.name, reason: 'Explain the missing AFK tag' },
   );
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'set.nickNote');
 }

 async setFromMessage(msg: RMessage, prefix: string | undefined) {
  const canRunCommand = await canUserExecuteCommand.call(
   this.client,
   AfkCommand.Afk,
   this.guild,
   this.userId,
   msg.channel_id,
  );
  this.plugin.logger.debug(
   `[Plugin:${this.plugin.name}] canUserExecuteCommand response: ${canRunCommand.response}, debug: ${canRunCommand.debug}`,
  );

  if (!canRunCommand.response) {
   (await this.plugin.getAPI(this.guild)).channels.addMessageReaction(
    this.guild,
    msg.channel_id,
    msg.id,
    { main: '❌', alt: '❌' },
    {
     origin: this.plugin.name,
     reason: 'User does not have permission to execute the AFK command',
    },
   );
   return;
  }

  const member = await this.client.cache.members.get(this.guild, this.userId);
  if (!member) return;

  const t = await this.t();
  const reason = await this.clampReason(
   msg.content.slice(AfkCommand.Afk.length + (prefix || '').length).trim() || null,
  );
  const content = await this.confirmation(t, await this.get());

  await this.save(reason);
  const skip = await this.setNick();

  const body = new MessagePayload(this.client, { origin: this.plugin.name, reason: 'Set AFK status' })
   .setContent(withNote(content, t, skip))
   .setEmbeds(await this.reasonEmbeds(reason, msg.channel_id, member.roles ?? []))
   .getAPIPayload();
  await postNotice.call(this.plugin, this.guild, msg.channel_id, body, t.t.setReason());

  const deleted = await (await this.plugin.getAPI(this.guild)).channels.deleteMessage(
   msg.channel_id,
   msg.id,
   { origin: this.plugin.name, reason: 'Clean up the command message after setting AFK status' },
  );
  if (deleted instanceof RequestHandlerError) {
   this.plugin.nonFatalError(deleted, 'setFromMessage.cleanup');
  }
 }

 async remove(msg: RMessage) {
  const afk = await this.get();
  if (!afk) return;
  if (Number(afk.since) > Date.now() - returnGraceMs) return;
  if ((await this.setting())?.ignoredChannels?.includes(msg.channel_id)) return;
  if (!(await this.clear())) return;

  const t = await this.t();
  const pings = await this.plugin.tracker.takePings(this.guild, this.userId, Number(afk.since));
  await this.plugin.tracker.saveReturn(this.guild, this.userId, {
   reason: afk.reason,
   since: Number(afk.since),
   pings,
  });

  const body = new MessagePayload(this.client, {
   origin: this.plugin.name,
   reason: 'AFK user returned',
  })
   .setReply(msg.id)
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    this.returnContainer(t, Number(afk.since), pings, false),
    this.returnButtons(t, pings),
   ])
   .getAPIPayload();

  const notice = await postNotice.call(
   this.plugin,
   this.guild,
   msg.channel_id,
   body,
   t.t.removeReason(),
  );
  scheduleNoticeDelete.call(
   this.plugin,
   notice,
   this.guild,
   t.t.removeReason(),
   returnNoticeLifetimeMs,
  );
  this.deleteNick(t.t.removeReason());
 }

 async forceRemove(cmd: APIChatInputApplicationCommandInteraction, reason: string) {
  const t = await this.t();
  if (!(await this.clear())) {
   ephemeralNote.call(this.plugin, cmd, t.t.notAfk({ user: this.userId }));
   return;
  }

  await this.plugin.tracker.takePings(this.guild, this.userId, 0);
  ephemeralNote.call(this.plugin, cmd, t.t.forceRemoved({ user: this.userId }));
  this.deleteNick(reason || t.t.forceRemoveReason());
 }

 async resetReason(cmd: APIChatInputApplicationCommandInteraction) {
  const t = await this.t();
  const { count } = await this.client.db.client.afkState.updateMany({
   where: { user: this.userId, guild: this.guild },
   data: { reason: null },
  });

  ephemeralNote.call(
   this.plugin,
   cmd,
   count ? t.t.reasonReset({ user: this.userId }) : t.t.notAfk({ user: this.userId }),
  );
 }

 async restore(cmd: APIMessageComponentInteraction) {
  const t = await this.t();
  if (await this.get()) {
   ephemeralNote.call(this.plugin, cmd, t.t.alreadyAfk());
   return;
  }

  const state = await this.plugin.tracker.takeReturn(this.guild, this.userId);
  if (!state) {
   ephemeralNote.call(this.plugin, cmd, t.t.restoreExpired());
   return;
  }

  await this.save(state.reason);
  await this.plugin.tracker.restorePings(this.guild, this.userId, state.pings);
  ephemeralNote.call(this.plugin, cmd, t.t.restored());

  const deleted = await (await this.plugin.getAPI(this.guild)).channels.deleteMessage(
   cmd.message.channel_id,
   cmd.message.id,
   { origin: this.plugin.name, reason: t.t.restoreReason() },
  );
  if (deleted instanceof RequestHandlerError) this.plugin.nonFatalError(deleted, 'restore.cleanup');
  this.setNick();
 }

 async dmPings(cmd: APIMessageComponentInteraction) {
  const t = await this.t();
  const state = await this.plugin.tracker.readReturn(this.guild, this.userId);
  if (!state) {
   ephemeralNote.call(this.plugin, cmd, t.t.restoreExpired());
   return;
  }

  const api = await this.plugin.getAPI(this.guild);
  const meta = { origin: this.plugin.name, reason: 'Send the AFK ping summary' };
  const dm = await api.users.createDM(this.userId, meta);
  const sent =
   dm instanceof RequestHandlerError
    ? dm
    : await api.channels.createDirectMessage(
       dm.id,
       {
        components: [this.returnContainer(t, state.since, state.pings, true)],
        flags: MessageFlags.IsComponentsV2,
        allowed_mentions: { parse: [] },
       },
       meta,
      );

  ephemeralNote.call(
   this.plugin,
   cmd,
   sent instanceof RequestHandlerError ? t.t.dmFailed() : t.t.dmSent(),
  );
 }

 private async save(reason: string | null | undefined): Promise<void> {
  await this.client.db.client.afkState.upsert({
   where: this.where,
   create: { user: this.userId, guild: this.guild, reason, since: Date.now() },
   update: { reason, since: Date.now() },
  });
 }

 private async clear(): Promise<boolean> {
  const { count } = await this.client.db.client.afkState.deleteMany({
   where: { user: this.userId, guild: this.guild },
  });
  return count > 0;
 }

 private setting() {
  return this.client.db.client.afkSetting.findFirst({ where: { guild: this.guild } });
 }

 private async clampReason(reason: string | null | undefined) {
  if (!reason) return reason;

  const setting = await this.setting();
  return reason.slice(0, setting?.maxLetters ?? defaultMaxLetters);
 }

 private async confirmation(t: Translator, afk: AfkStateRow | null) {
  const user = await this.client.cache.users.get(this.userId);
  const status = afk ? t.t.updated({ user }) : t.t.set({ user });
  return `${status}\n${t.t.graceNote()}`;
 }

 private async reasonEmbeds(
  reason: string | null | undefined,
  channelId: string,
  roleIds: string[],
 ): Promise<EmbedBuilder[]> {
  if (!reason) return [];

  const censored = await getCensoredContent.call(
   this.plugin,
   this.guild,
   reason,
   channelId,
   roleIds,
  );
  return [new EmbedBuilder().setColor(Colors.Loading).setDescription(`-# ${censored}`)];
 }

 private returnContainer(t: Translator, since: number, pings: AfkPing[], withPreviews: boolean) {
  const container = new ContainerBuilder()
   .setAccentColor(Colors.Loading)
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     t.t.removed({ time: constants.formatters.getTime(since) }),
    ),
   );
  if (!pings.length) return container.toJSON();

  const lines = pings.slice(0, shownPings).map((ping) =>
   t.t.pingLine({
    user: ping.author,
    link: messageLink(this.guild, ping.channel, ping.message),
    preview: withPreviews && ping.preview ? `\n> -# ${ping.preview}` : '',
   }),
  );
  const more = pings.length - shownPings;

  return container
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     [
      t.t.pingsTitle({ count: String(pings.length) }),
      ...lines,
      ...(more > 0 ? [t.t.pingsMore({ count: String(more) })] : []),
     ].join('\n'),
    ),
   )
   .toJSON();
 }

 private returnButtons(t: Translator, pings: AfkPing[]) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setCustomId(this.plugin.getRoute(AfkRoute.Restore, this.userId))
    .setStyle(ButtonStyle.Secondary)
    .setLabel(t.t.restoreButton()),
  );
  if (!pings.length) return row.toJSON();

  return row
   .addComponents(
    new ButtonBuilder()
     .setCustomId(this.plugin.getRoute(AfkRoute.DmPings, this.userId))
     .setStyle(ButtonStyle.Secondary)
     .setLabel(t.t.dmButton()),
   )
   .toJSON();
 }

 private async setNick(): Promise<NickSkip | null> {
  const member = await this.client.cache.members.get(this.guild, this.userId);
  if (!member) return NickSkip.Failed;
  if (afkSuffixOf(member.nick)) return null;

  const guild = await this.client.cache.guilds.get(this.guild);
  if (guild?.owner_id === this.userId) return NickSkip.Owner;

  const base = member.nick || (await this.displayName());
  if (!base) return NickSkip.Failed;

  const nick = taggedNick(base);
  if (!nick) return NickSkip.TooLong;

  const res = await (await this.plugin.getAPI(this.guild)).guilds.editMember(
   this.guild,
   this.userId,
   { nick },
   { origin: this.plugin.name, reason: 'Reflect AFK status in nickname' },
  );
  if (!(res instanceof RequestHandlerError)) return null;

  this.plugin.nonFatalError(res, 'setNick');
  return NickSkip.Failed;
 }

 private async deleteNick(reason: string) {
  const member = await this.client.cache.members.get(this.guild, this.userId);
  if (!member?.nick || !afkSuffixOf(member.nick)) return;

  const res = await (await this.plugin.getAPI(this.guild)).guilds.editMember(
   this.guild,
   this.userId,
   { nick: untaggedNick(member.nick, await this.displayName()) },
   { reason, origin: this.plugin.name },
  );
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'deleteNick');
 }

 private async displayName(): Promise<string | null> {
  const user = await getUser.call(this.client, this.userId);
  if (!user || user instanceof RequestHandlerError) return null;

  return user.global_name || user.username;
 }
}
