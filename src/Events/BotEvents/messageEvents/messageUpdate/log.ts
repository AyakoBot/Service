import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (oldMsg: RMessage, msg: RMessage) => {
 if (!msg.inGuild()) return;
 if (msg.author?.id === (await msg.client.util.getBotIdFromGuild(msg.guild))) return;

 const channels = await msg.client.util.getLogChannels('messageevents', msg.guild);
 if (!channels) return;

 const language = await msg.client.util.getLanguage(msg.guildId);
 const lan = language.events.logs.message;
 const con = msg.client.util.constants.events.logs.message;
 const files: Discord.AttachmentPayload[] = [];
 let byAuthor: boolean | null = true;

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: con.update,
   name: lan.nameUpdate,
  },
  fields: [],
  color: CT.Colors.Loading,
  timestamp: new Date().toISOString(),
 };

 const merge = (before: unknown, after: unknown, type: CT.AcceptedMergingTypes, name: string) =>
  msg.client.util.mergeLogging(before, after, type, embed, language, name);

 if (oldMsg.flags !== msg.flags) {
  const oldFlags = new RMessageFlagsBitField(oldMsg.flags).toArray();
  const newFlags = new RMessageFlagsBitField(msg.flags).toArray();

  const added = msg.client.util
   .getDifference(oldFlags, newFlags)
   .map((f) => lan.flags[f as unknown as RMessageFlagsString]);
  const removed = msg.client.util
   .getDifference(newFlags, oldFlags)
   .map((f) => lan.flags[f as unknown as RMessageFlagsString]);

  if (added.length || removed.length) merge(removed, added, 'difference', language.t.Flags);
 }
 if (
  JSON.stringify(oldMsg.components) !== JSON.stringify(msg.components) &&
  !!oldMsg.components?.length
 ) {
  if (oldMsg.components?.length) {
   const components = msg.client.util.txtFileWriter(
    oldMsg.components.map((c) => JSON.stringify(c, null, 2)),
    undefined,
    lan.components,
   );

   if (components) files.push(components);
  }
 }
 if (oldMsg.editedTimestamp !== msg.editedTimestamp) {
  merge(
   oldMsg.editedTimestamp
    ? msg.client.util.constants.standard.getTime(oldMsg.editedTimestamp)
    : language.t.None,
   msg.editedTimestamp
    ? msg.client.util.constants.standard.getTime(msg.editedTimestamp)
    : language.t.None,
   'string',
   lan.editedTimestamp,
  );
 }
 if (oldMsg.activity?.type !== msg.activity?.type) {
  merge(
   oldMsg.activity ? lan.activity[oldMsg.activity?.type] : language.t.None,
   msg.activity ? lan.activity[msg.activity?.type] : language.t.None,
   'string',
   language.t.Flags,
  );

  byAuthor = false;
 }
 if (oldMsg.thread?.id !== msg.thread?.id) {
  merge(
   oldMsg.thread
    ? language.languageFunction.getChannel(oldMsg.thread, language.channelTypes[oldMsg.thread.type])
    : language.t.None,
   msg.thread
    ? language.languageFunction.getChannel(msg.thread, language.channelTypes[msg.thread.type])
    : language.t.None,
   'string',
   language.channelTypes[(msg.thread ?? oldMsg.thread)?.type ?? 11],
  );

  byAuthor = false;
 }
 if (JSON.stringify(oldMsg.stickers) !== JSON.stringify(msg.stickers)) {
  const oldStickers = msg.client.util.getDifference(
   oldMsg.stickers.map((o) => o) ?? [],
   msg.stickers.map((o) => o) ?? [],
  );
  const newStickers = msg.client.util.getDifference(
   msg.stickers.map((o) => o) ?? [],
   oldMsg.stickers.map((o) => o) ?? [],
  );

  merge(oldStickers, newStickers, 'difference', lan.stickers);
 }
 if (oldMsg.type !== msg.type) {
  merge(
   lan.type[oldMsg.type] ?? language.t.Unknown,
   lan.type[msg.type] ?? language.t.Unknown,
   'string',
   language.t.Type,
  );

  byAuthor = false;
 }
 if (oldMsg.content !== msg.content) {
  if (oldMsg.content?.length > 1024) {
   const content = msg.client.util.txtFileWriter(oldMsg.content, undefined, language.t.content);
   if (content) files.push(content);
  } else {
   embed.fields?.push({
    name: lan.beforeContent,
    value: oldMsg.content ?? language.t.None,
    inline: false,
   });
  }

  if (msg.content?.length > 1024) {
   const content = msg.client.util.txtFileWriter(msg.content, undefined, language.t.content);
   if (content) files.push(content);
  } else {
   embed.fields?.push({
    name: lan.afterContent,
    value: msg.content ?? language.t.None,
    inline: false,
   });
  }
 }
 if (JSON.stringify(oldMsg.embeds.map((o) => o)) !== JSON.stringify(msg.embeds.map((o) => o))) {
  if (!msg.embeds.length) byAuthor = null;

  if (oldMsg.embeds?.length) {
   const embedFile = msg.client.util.txtFileWriter(
    JSON.stringify(oldMsg.embeds, null, 2),
    undefined,
    language.t.Embeds,
   );
   if (embedFile) files.push(embedFile);
  }
 }
 if (msg.mentions.everyone !== oldMsg.mentions.everyone) {
  merge(oldMsg.mentions.everyone, msg.mentions.everyone, 'boolean', lan.mentionEveryone);
 }
 if (
  JSON.stringify(oldMsg.attachments.map((o) => o)) !== JSON.stringify(msg.attachments.map((o) => o))
 ) {
  if (!msg.attachments.size) byAuthor = null;

  const oldAttachments = msg.client.util.getDifference(
   oldMsg.attachments.map((o) => o) ?? [],
   msg.attachments.map((o) => o) ?? [],
  );

  const attachments = (
   await msg.client.util.fileURL2Buffer(oldAttachments.map((a) => a.url))
  ).filter((e): e is Discord.AttachmentPayload => !!e);

  if (attachments?.length) files.push(...attachments);
 }
 if (
  JSON.stringify(oldMsg.mentions.users.map((o) => o)) !==
  JSON.stringify(msg.mentions.users.map((o) => o))
 ) {
  const oldMentions = msg.client.util.getDifference(
   oldMsg.mentions.users.map((o) => o),
   msg.mentions.users.map((o) => o),
  ) as RUser[];
  const newMentions = msg.client.util.getDifference(
   msg.mentions.users.map((o) => o),
   oldMsg.mentions.users.map((o) => o),
  ) as RUser[];

  merge(
   oldMentions.map((i) => `<@${i.id}>`).join(', ') ?? language.t.None,
   newMentions.map((i) => `<@${i.id}>`).join(', ') ?? language.t.None,
   'string',
   lan.mentionedUsers,
  );
 }
 if (
  JSON.stringify(oldMsg.mentions.roles.map((o) => o)) !==
  JSON.stringify(msg.mentions.roles.map((o) => o))
 ) {
  const oldMentions = msg.client.util.getDifference(
   oldMsg.mentions.roles.map((o) => o),
   msg.mentions.roles.map((o) => o),
  ) as RRole[];
  const newMentions = msg.client.util.getDifference(
   msg.mentions.roles.map((o) => o),
   oldMsg.mentions.roles.map((o) => o),
  ) as RRole[];

  merge(
   oldMentions.map((i) => `<@&${i.id}>`).join(', '),
   newMentions.map((i) => `<@&${i.id}>`).join(', '),
   'string',
   lan.mentionedRoles,
  );
 }
 if (
  JSON.stringify(oldMsg.mentions.channels.map((o) => o)) !==
  JSON.stringify(msg.mentions.channels.map((o) => o))
 ) {
  const oldMentions = msg.client.util.getDifference(
   oldMsg.mentions.channels.map((o) => o),
   msg.mentions.channels.map((o) => o),
  ) as Discord.Channel[];
  const newMentions = msg.client.util.getDifference(
   msg.mentions.channels.map((o) => o),
   oldMsg.mentions.channels.map((o) => o),
  ) as Discord.Channel[];

  merge(
   oldMentions.map((i) => `<#${i.id}>`).join(', '),
   newMentions.map((i) => `<#${i.id}>`).join(', '),
   'string',
   lan.mentionedChannels,
  );
 }

 if (byAuthor === null) embed.description = lan.descUpdateMaybe(msg);
 else if (byAuthor === false) embed.description = lan.descUpdate(msg);
 else embed.description = lan.descUpdateAuthor(msg);

 if (!embed.fields?.length) return;

 msg.client.util.send({ id: channels, guildId: msg.guildId }, { embeds: [embed], files }, 10000);
};
