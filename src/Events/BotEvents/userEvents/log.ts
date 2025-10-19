import type * as Discord from 'discord.js';
import * as CT from '../../../Typings/Typings.js';

export default async (oldUser: RUser, user: RUser, guild: Discord.Guild) => {
 const channels = await guild.client.util.getLogChannels('userevents', guild);
 if (!channels) return;

 const language = await guild.client.util.getLanguage(guild.id);
 const lan = language.events.logs.user;
 const files: Discord.AttachmentPayload[] = [];

 const embed: Discord.APIEmbed = {
  author: {
   name: lan.name,
   url: guild.client.util.constants.standard.userURL(user),
  },
  description: lan.desc(user),
  fields: [],
  color: CT.Colors.Loading,
  timestamp: new Date().toISOString(),
 };

 const merge = (before: unknown, after: unknown, type: CT.AcceptedMergingTypes, name: string) =>
  guild.client.util.mergeLogging(before, after, type, embed, language, name);

 if (user.avatar !== oldUser.avatar) {
  const attachment = (
   await guild.client.util.fileURL2Buffer([user.displayAvatarURL({ size: 4096 })])
  )?.[0];

  merge(
   user.displayAvatarURL({ size: 4096 }),
   guild.client.util.getNameAndFileType(user.displayAvatarURL({ size: 4096 })),
   'icon',
   lan.avatar,
  );

  if (attachment) files.push(attachment);
 }
 if (user.globalName !== oldUser.globalName) {
  merge(oldUser.globalName ?? language.t.Unknown, user.globalName, 'string', lan.globalName);
 }
 if (user.flags !== oldUser.flags) {
  const flagsBefore = oldUser.flags?.toArray() ?? [];
  const flagsAfter = user.flags?.toArray() ?? [];

  const removed = guild.client.util.getDifference(
   flagsBefore,
   flagsAfter,
  ) as unknown as typeof flagsBefore;
  const added = guild.client.util.getDifference(
   flagsAfter,
   flagsBefore,
  ) as unknown as typeof flagsAfter;

  if (removed.length || added.length) {
   merge(
    added
     .map((r) => (flagsBefore.length ? `\`${language.userFlags[r]}\`` : language.t.Unknown))
     .join(', '),
    removed
     .map((r) => (flagsAfter.length ? `\`${language.userFlags[r]}\`` : language.t.Unknown))
     .join(', '),
    'difference',
    lan.flags,
   );
  }
 }
 if (user.discriminator !== oldUser.discriminator) {
  merge(
   oldUser.discriminator ?? language.t.Unknown,
   user.discriminator,
   'string',
   lan.discriminator,
  );
 }
 if (user.username !== oldUser.username) {
  merge(oldUser.username ?? language.t.Unknown, user.username, 'string', lan.username);
 }

 if (!embed.fields?.length) return;

 guild.client.util.send({ id: channels, guildId: guild.id }, { embeds: [embed], files }, 10000);
};
