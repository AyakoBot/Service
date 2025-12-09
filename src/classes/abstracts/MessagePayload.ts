import type {
 AllowedMentionsTypes,
 APIAllowedMentions,
 APIEmbed,
 APIMessageTopLevelComponent,
 CreateMessageOptions,
 MessageFlags,
} from '@discordjs/core';
import type { RawFile } from '@discordjs/rest';

import type Client from '../Client.js';
import Logger from '../Logger.js';

type Channel =
 | RUser
 | RChannel
 | RThread
 | (RUser | RChannel | RThread)[]
 | { id: string | string[]; guildId: string };

export class MessagePayload {
 private client: typeof Client.prototype;

 files: RawFile[] = [];
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
 channels: Channel[] = [];

 constructor(client: typeof Client.prototype) {
  this.client = client;
  Logger.silly('[MessagePayload] Created new payload');
 }

 set setWebhook({ webhookId, webhookToken }: { webhookId: string; webhookToken?: string }) {
  this.webhookId = webhookId;
  this.webhookToken = webhookToken;
 }

 set setMergeTimeout(timeout: number) {
  this.mergeTimeout = timeout;
 }

 set setNick(nick: string | null) {
  this.nick = nick;
 }

 set setAvatarURL(avatarURL: string | null) {
  this.avatarURL = avatarURL;
 }

 set setChannels(channels: Channel[]) {
  this.channels = channels;
 }

 addChannels(...channels: Channel[]) {
  this.channels.push(...channels);
 }

 set setComponents(components: APIMessageTopLevelComponent[] | null) {
  this.components = components;
 }

 addComponents(...components: APIMessageTopLevelComponent[]) {
  if (this.components === null) this.components = [];
  this.components.push(...components);
 }

 set setFiles(files: RawFile[]) {
  this.files = files;
 }

 addFiles(...files: RawFile[]) {
  this.files.push(...files);
 }

 set setContent(content: string | null) {
  this.content = content;
 }

 set setEmbeds(embeds: APIEmbed[]) {
  this.embeds = embeds;
 }

 addEmbeds(...embeds: APIEmbed[]) {
  this.embeds.push(...embeds);
 }

 set setFlags(flags: MessageFlags | 0) {
  this.flags = flags;
 }

 set addFlags(flags: MessageFlags) {
  this.flags |= flags;
 }

 set setAllowedMentionsParse(parse: AllowedMentionsTypes[] | null) {
  if (parse === null) {
   this.allowedMentions = null;
   return;
  }

  this.allowedMentions = { ...this.allowedMentions, parse };
 }

 set setAllowedMentionsUsers(users: string[] | null) {
  if (users === null) {
   this.allowedMentions = null;
   return;
  }

  this.allowedMentions = { ...this.allowedMentions, users };
 }

 set setAllowedMentionsRoles(roles: string[] | null) {
  if (roles === null) {
   this.allowedMentions = null;
   return;
  }

  this.allowedMentions = { ...this.allowedMentions, roles };
 }

 set setAllowedMentionsRepliedUser(repliedUser: boolean | null) {
  if (repliedUser === null) {
   this.allowedMentions = null;
   return;
  }

  this.allowedMentions = { ...this.allowedMentions, replied_user: repliedUser };
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
   allowed_mentions: this.allowedMentions || undefined,
   components: this.components || undefined,
   files: this.files.length ? this.files : undefined,
  };
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
  Logger.debug('[MessagePayload] Sending to', this.channels.length, 'channel(s)');

  const channels: { channelId: string | Promise<string | undefined>; guildId: string | '@me' }[] =
   [];

  this.channels.forEach((channel) => {
   if (Array.isArray(channel)) {
    channel.forEach((c) =>
     channels.push({
      channelId: 'username' in c ? this.getDM(c.id) : c.id,
      guildId: 'guild_id' in c ? c.guild_id : '@me',
     }),
    );
    return;
   }

   if (Array.isArray(channel.id)) {
    channel.id.forEach((id) =>
     channels.push({ channelId: id, guildId: 'guild_id' in channel ? channel.guild_id : '@me' }),
    );
    return;
   }

   channels.push({
    channelId: 'username' in channel ? this.getDM(channel.id) : channel.id,
    guildId: 'guild_id' in channel ? channel.guild_id : '@me',
   });
  });

  return Promise.all(
   channels.map((c) =>
    this.client.sendMessageCache.queueMessage(c.channelId, c.guildId, this, this.mergeTimeout),
   ),
  );
 };

 private async getDM(userId: string) {
  Logger.silly('[MessagePayload] Opening DM channel for user:', userId);
  const dm = await this.client.api.users.createDM(userId).catch(() => null);
  if (!dm) Logger.debug('[MessagePayload] Failed to open DM for user:', userId);
  return dm?.id;
 }
}
