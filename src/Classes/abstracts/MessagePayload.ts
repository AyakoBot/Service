import { RequestHandlerError } from '@ayako/api';
import { logger, type RChannel, type RMessage, type RThread, type RUser } from '@ayako/utility';
import { EmbedBuilder } from '@discordjs/builders';
import type {
 AllowedMentionsTypes,
 APIAllowedMentions,
 APIApplicationCommandInteraction,
 APIEmbed,
 APIMessageTopLevelComponent,
 CreateMessageOptions,
 DescriptiveRawFile,
 MessageFlags,
} from '@discordjs/core';

import type Client from '../Client.js';

type SendTo = {
 channel: RUser | RChannel | RThread | RUser[] | RChannel[] | RThread[] | string | string[];
 guildId: string;
};

export class MessagePayload {
 private client: typeof Client.prototype;

 files: DescriptiveRawFile[] = [];
 content?: string | null = null;
 embeds: APIEmbed[] = [];
 flags: MessageFlags | 0 = 0;
 allowedMentions: APIAllowedMentions | null = null;
 components: APIMessageTopLevelComponent[] | null = null;

 nick: string | null = null;
 avatarURL: string | null = null;
 webhookId: string | null = null;
 webhookToken: string | undefined = undefined;

 mergeTimeout: number = 0;
 sendTo: SendTo[] = [];

 origin: string;
 reason: string;

 constructor(
  client: typeof Client.prototype,
  { origin, reason }: { origin: string; reason: string },
 ) {
  this.client = client;
  this.origin = origin;
  this.reason = reason;
  logger.silly('[MessagePayload] Created new payload');
 }

 setWebhook({ webhookId, webhookToken }: { webhookId: string; webhookToken?: string }) {
  this.webhookId = webhookId;
  this.webhookToken = webhookToken;
  return this;
 }

 setMergeTimeout(timeout: number) {
  this.mergeTimeout = timeout;
  return this;
 }

 setNick(nick: string | null) {
  this.nick = nick;
  return this;
 }

 setAvatarURL(avatarURL: string | null) {
  this.avatarURL = avatarURL;
  return this;
 }

 setSendTo(sendTo: SendTo[]) {
  this.sendTo = sendTo;
  return this;
 }

 addSendTo(...sendTo: SendTo[]) {
  this.sendTo.push(...sendTo);
  return this;
 }

 setComponents(components: APIMessageTopLevelComponent[] | null) {
  this.components = components;
  return this;
 }

 addComponents(...components: APIMessageTopLevelComponent[]) {
  if (this.components === null) this.components = [];
  this.components.push(...components);
  return this;
 }

 setFiles(files: DescriptiveRawFile[]) {
  this.files = files;
  return this;
 }

 addFiles(...files: DescriptiveRawFile[]) {
  this.files.push(...files);
  return this;
 }

 setContent(content: string | null) {
  this.content = content;
  return this;
 }

 setEmbeds(embeds: (APIEmbed | EmbedBuilder)[]) {
  this.embeds = embeds.map((e) => (e instanceof EmbedBuilder ? e.toJSON() : e));

  return this;
 }

 addEmbeds(...embeds: (APIEmbed | EmbedBuilder)[]) {
  embeds.forEach((e) => {
   if (e instanceof EmbedBuilder) this.embeds.push(e.toJSON());
   else this.embeds.push(e);
  });

  return this;
 }

 setFlags(flags: MessageFlags | 0) {
  this.flags = flags;
  return this;
 }

 addFlags(flags: MessageFlags) {
  this.flags |= flags;
  return this;
 }

 setAllowedMentionsParse(parse: AllowedMentionsTypes[] | null) {
  if (parse === null) {
   this.allowedMentions = null;
   return this;
  }

  this.allowedMentions = { ...this.allowedMentions, parse };
  return this;
 }

 setAllowedMentionsUsers(users: string[] | null) {
  if (users === null) {
   this.allowedMentions = null;
   return this;
  }

  this.allowedMentions = { ...this.allowedMentions, users };
  return this;
 }

 setAllowedMentionsRoles(roles: string[] | null) {
  if (roles === null) {
   this.allowedMentions = null;
   return this;
  }

  this.allowedMentions = { ...this.allowedMentions, roles };
  return this;
 }

 setAllowedMentionsRepliedUser(repliedUser: boolean | null) {
  if (repliedUser === null) {
   this.allowedMentions = null;
   return this;
  }

  this.allowedMentions = { ...this.allowedMentions, replied_user: repliedUser };
  return this;
 }

 validate() {
  const e = (text: string, log: unknown) => {
   this.client.logger.error(`> ${text}\n${JSON.stringify(log)}`);
   this.client.logger.debug(text);
   return false;
  };

  if (Number(this.content?.length) > 2000) return e('Content too long', this.content);
  if (this.embeds?.length) {
   if (Number(this.embeds.length) > 10) return e('Too many Embeds', this.embeds);
   if (this.embeds && this.embedCharLense() > 6000) {
    return e('Embeds content too long', this.embeds);
   }

   const embedsValid = this.embeds
    .map((embed) => {
     if (Number(embed.title?.length) > 256) return e('Embed Title too long', embed.title);
     if (Number(embed.description?.length) > 4096) {
      return e('Embed Description too long', embed.description);
     }

     if (Number(embed.footer?.text?.length) > 2048) return e('Embed Footer too long', embed.footer);
     if (Number(embed.author?.name?.length) > 2048) return e('Embed Author too long', embed.author);

     if (!embed.fields?.length) return true;
     if (embed.fields.length > 25) return e('Too many Embed Fields', embed.fields);
     return embed.fields
      ?.map((f) => {
       if (Number(f.name?.length) > 256) return e('Embed Field Name too long', f.name);
       if (Number(f.value?.length) > 1024) return e('Embed Field Value too long', f.value);
       return true;
      })
      .every((f) => !!f);
    })
    .every((f) => !!f);

   if (!embedsValid) return embedsValid;
  }

  // TODO: Component validator with new Components V2

  return true;
 }

 getAPIPayload(): CreateMessageOptions {
  return {
   content: this.content ?? undefined,
   embeds: this.embeds.length ? this.embeds : undefined,
   flags: this.flags || undefined,
   components: this.components || undefined,
   files: this.files.length ? this.files : undefined,
   allowed_mentions: this.getAllowedMentions(),
  };
 }

 private getAllowedMentions(): APIAllowedMentions {
  return this.allowedMentions
   ? {
      parse: this.allowedMentions.parse ?? [],
      replied_user: this.allowedMentions.replied_user ?? true,
      roles: this.allowedMentions.roles ?? [],
      users: this.allowedMentions.users ?? [],
     }
   : { parse: [], replied_user: true, roles: [], users: [] };
 }

 private embedCharLense() {
  let total = 0;

  this.embeds.forEach((embed) => {
   Object.values(embed).forEach((data) => {
    if (typeof data === 'string') total += data.length;
   });

   for (let i = 0; i < (embed.fields ? embed.fields.length : 0); i += 1) {
    const field = embed.fields ? embed.fields[i] : null;

    if (!field) return;

    if (typeof field.name === 'string') total += field.name.length;
    if (typeof field.value === 'string') total += field.value.length;
   }
  });
  return total;
 }

 send = async (): Promise<(RMessage | undefined)[]> => {
  logger.debug('[MessagePayload] Sending to', this.sendTo.length, 'channel(s)');

  const channels: { channelId: string | Promise<string | undefined>; guildId: string | '@me' }[] =
   [];

  this.sendTo.forEach((sendTo) => {
   if (Array.isArray(sendTo.channel)) {
    sendTo.channel.forEach((c) =>
     channels.push({
      channelId:
       typeof c === 'string' ? c : 'username' in c ? this.getDM(c.id, sendTo.guildId) : c.id,
      guildId: sendTo.guildId,
     }),
    );
    return;
   }

   channels.push({
    channelId:
     typeof sendTo.channel === 'string'
      ? sendTo.channel
      : 'username' in sendTo.channel
        ? this.getDM(sendTo.channel.id, sendTo.guildId)
        : sendTo.channel.id,
    guildId: sendTo.guildId,
   });
  });

  return Promise.all(
   channels.map((c) =>
    this.client.sendMessageCache.queueMessage(c.channelId, c.guildId, this, this.mergeTimeout),
   ),
  );
 };

 private async getDM(userId: string, guildId: string | undefined = undefined) {
  logger.silly('[MessagePayload] Opening DM channel for user:', userId);
  const dm = await (
   await this.client.getAPI(guildId)
  ).users
   .createDM(userId, {
    origin: this.origin,
    reason: this.reason,
   })
   .then((res) => (res instanceof RequestHandlerError ? null : res));

  if (!dm) logger.debug('[MessagePayload] Failed to open DM for user:', userId);
  return dm?.id;
 }

 reply(cmd: APIApplicationCommandInteraction, debugInfo: { origin: string; reason: string }) {
  return this.client
   .getAPI(cmd.guild_id)
   .then((api) => api.interactions.reply(cmd.id, cmd.token, this.getAPIPayload(), debugInfo));
 }
}
