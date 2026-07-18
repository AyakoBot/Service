import { RequestHandlerError } from '@ayako/api';
import type { AfkState as AfkStateRow } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import { ContainerBuilder, EmbedBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 ApplicationCommandOptionType,
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../Classes/Constants.js';
import { Colors } from '../../../Types/index.js';
import getUser from '../../../Util/getUser.js';
import { AfkCommand } from '../Enums.js';
import type AFKPlugin from '../Plugin.js';
import canUserExecuteCommand from '../Util/canUserExecuteCommand.js';
import { getCensoredContent } from '../Util/censorContent.js';
import { scheduleNoticeDelete } from '../Util/scheduleNoticeDelete.js';

import DBAfk from './DBAfk.js';

type Translator = Awaited<ReturnType<AFKPlugin['t']>>;

const returnGraceMs = 60000;
const nickLengthLimit = 32;
const afkNickSuffixFull = ' [AFK]';
const afkNickSuffixShort = ' AFK';

const afkNickSuffixFor = (baseLength: number) => {
 if (baseLength + afkNickSuffixFull.length <= nickLengthLimit) return afkNickSuffixFull;
 if (baseLength + afkNickSuffixShort.length <= nickLengthLimit) return afkNickSuffixShort;
 return undefined;
};

export default class Afk extends DBAfk {
 static async notifyMentions(plugin: AFKPlugin, msg: RMessage) {
  if (!msg.mention_users?.length) return;
  if (msg.mention_users.length > 10) return;

  const mentionedIds = msg.mention_users.filter((id) => id !== msg.author_id);
  if (!mentionedIds.length) return;

  const afkStates = await Promise.all(
   mentionedIds.map((userId) => new Afk(plugin, userId, msg.guild_id).get()),
  );

  const activeAfks = afkStates.filter((a): a is NonNullable<typeof a> => !!a);
  if (!activeAfks.length) return;

  const t = await plugin.t(msg.guild_id);

  const [m] = await new MessagePayload(plugin.client, {
   origin: plugin.name,
   reason: 'A mentioned user is AFK',
  })
   .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id }])
   .setReply(msg.id)
   .setFlags(MessageFlags.IsComponentsV2)
   .setAllowedMentionsRepliedUser(true)
   .setComponents(
    activeAfks.map((afk) =>
     new ContainerBuilder()
      .setAccentColor(Colors.Loading)
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        t.t.isAFK({
         user: afk.userId,
         since: constants.formatters.getTime(Number(afk.since)),
         text: afk.reason ? `\n> -# ${afk.reason}` : ' ',
        }),
       ),
      )
      .toJSON(),
    ),
   )
   .send();

  scheduleNoticeDelete.call(plugin, m, msg.guild_id, t.t.replyReason());
 }

 private t() {
  return this.plugin.t(this.guild);
 }

 async set(cmd: APIChatInputApplicationCommandInteraction) {
  if (!cmd.channel.id) return;

  const member = cmd.member || (await this.client.cache.members.get(this.guild, this.userId));

  const reason = await this.clampReason(
   cmd.data.options
    ?.filter((o) => o.type === ApplicationCommandOptionType.String)
    .find((o) => o.name === 'reason')?.value as string | undefined,
  );

  const afk = await this.get();

  new MessagePayload(this.client, { origin: this.plugin.name, reason: 'Set AFK status' })
   .setSendTo([{ channel: cmd.channel.id, guildId: this.guild }])
   .setContent(await this.statusContent(afk))
   .setEmbeds(await this.reasonEmbeds(reason, cmd.channel.id, member?.roles ?? []))
   .reply(cmd);

  await super.set(cmd, reason);
  this.setNick();
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

  const reason = await this.clampReason(
   msg.content.slice(AfkCommand.Afk.length + (prefix || '').length).trim() || null,
  );

  const afk = await this.get();

  new MessagePayload(this.client, { origin: this.plugin.name, reason: 'Set AFK status' })
   .setSendTo([{ channel: msg.channel_id, guildId: this.guild }])
   .setContent(await this.statusContent(afk))
   .setEmbeds(await this.reasonEmbeds(reason, msg.channel_id, member.roles ?? []))
   .send();

  await super.set(msg, reason);
  this.setNick();

  (await this.plugin.getAPI(this.guild)).channels.deleteMessage(msg.channel_id, msg.id, {
   origin: this.plugin.name,
   reason: 'Clean up the command message after setting AFK status',
  });
 }

 async remove(msg: RMessage) {
  const afk = await this.get();
  if (!afk) return;
  if (Number(afk.since) > Date.now() - returnGraceMs) return;

  const t = await this.t();

  const [m] = await new MessagePayload(this.client, {
   origin: this.plugin.name,
   reason: 'AFK user returned',
  })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: this.guild }])
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([
    new ContainerBuilder()
     .setAccentColor(Colors.Loading)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       t.t.removed({ time: constants.formatters.getTime(Number(afk.since)) }),
      ),
     )
     .toJSON(),
   ])
   .send();

  scheduleNoticeDelete.call(this.plugin, m, this.guild, t.t.removeReason());

  await super.remove(msg);
  this.deleteNick(t);
 }

 private async statusContent(afk: AfkStateRow | null) {
  const t = await this.t();

  if (!afk) return t.t.set({ user: await this.client.cache.users.get(this.userId) });
  return t.t.updated({ user: await this.client.cache.users.get(this.userId) });
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

 private async setNick() {
  const member = await this.client.cache.members.get(this.guild, this.userId);
  if (!member) return;
  if (member.nick?.includes('AFK')) return;

  const user = member.nick
   ? { username: '', global_name: '' }
   : await getUser.call(this.client, this.userId);
  if (user instanceof RequestHandlerError || !user) return;

  const base = member.nick || user.global_name || user.username;
  const suffix = afkNickSuffixFor(base.length);
  if (!suffix) return;

  const res = await (await this.plugin.getAPI(this.guild)).guilds.editMember(
   this.guild,
   this.userId,
   { nick: `${base}${suffix}` },
   { origin: this.plugin.name, reason: 'Reflect AFK status in nickname' },
  );

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'setNick');
 }

 private async deleteNick(t: Translator) {
  const member = await this.client.cache.members.get(this.guild, this.userId);
  if (!member?.nick) return;

  const { nick } = member;
  if (!nick.includes('AFK')) return;

  const cleaned = nick
   .replace(/\[AFK\]/g, '')
   .replace(/AFK/g, '')
   .replace(/\s+/g, ' ')
   .trim();

  const res = await (await this.plugin.getAPI(this.guild)).guilds.editMember(
   member.guild_id,
   member.user_id,
   { nick: cleaned || null },
   { reason: t.t.removeReason(), origin: this.plugin.name },
  );

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'deleteNick');
 }
}
