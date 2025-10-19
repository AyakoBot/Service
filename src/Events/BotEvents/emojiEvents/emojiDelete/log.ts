import type * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (emote: Discord.GuildEmoji) => {
 const channels = await emote.client.util.getLogChannels('emojievents', emote.guild);
 if (!channels) return;

 const language = await emote.client.util.getLanguage(emote.guild.id);
 const lan = language.events.logs.guild;
 const con = emote.client.util.constants.events.logs.emoji;
 const audit = await emote.client.util.getAudit(emote.guild, 62, emote.id);
 const auditUser = audit?.executor ?? undefined;
 const files: Discord.AttachmentPayload[] = [];

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: con.delete,
   name: lan.emojiDelete,
  },
  description: auditUser ? lan.descEmojiDeleteAudit(auditUser, emote) : lan.descEmojiDelete(emote),
  fields: [],
  color: CT.Colors.Danger,
 };

 const attachment = (await emote.client.util.fileURL2Buffer([emote.url]))?.[0];
 if (attachment) {
  files.push(attachment);

  embed.thumbnail = {
   url: `attachment://${emote.client.util.getNameAndFileType(emote.url)}`,
  };
 }

 emote.client.util.send(
  { id: channels, guildId: emote.guild.id },
  { embeds: [embed], files },
  10000,
 );
};
