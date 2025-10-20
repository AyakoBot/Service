import * as Discord from 'discord.js';

type ClearType =
 | 'all'
 | 'user'
 | 'between'
 | 'match'
 | 'not-match'
 | 'starts-with'
 | 'ends-with'
 | 'includes'
 | 'links'
 | 'invites'
 | 'images'
 | 'videos'
 | 'files'
 | 'audio'
 | 'mentions'
 | 'stickers'
 | 'embeds'
 | 'text'
 | 'humans'
 | 'bots';

export default async (
 cmd: Discord.ChatInputCommandInteraction | RMessage,
 args: string[],
 type: ClearType = 'all',
) => {
 const isCmd = cmd instanceof Discord.ChatInputCommandInteraction;

 if (isCmd ? !cmd.inCachedGuild() : !cmd.inGuild()) return;
 if (!cmd.channel) return;

 if (isCmd) await cmd.deferReply({ ephemeral: true });

 const rawAmount = isCmd ? undefined : getAmount(args);
 if (rawAmount && !isCmd && !validAmount(rawAmount)) {
  cmd.client.util.request.channels.addReaction(
   cmd,
   cmd.client.util.constants.standard.getEmoteIdentifier(cmd.client.util.emotes.cross),
  );
  return;
 }

 const amount = isCmd ? cmd.options.getInteger('amount', false) : rawAmount;
 const channel = isCmd
  ? (cmd.options.getChannel('channel', false, [
     ChannelType.AnnouncementThread,
     ChannelType.PublicThread,
     ChannelType.GuildAnnouncement,
     ChannelType.PrivateThread,
     ChannelType.GuildStageVoice,
     ChannelType.GuildText,
     ChannelType.GuildVoice,
    ]) ?? (cmd.channel as RChannel))
  : cmd.channel;

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.clear;
 const allMessages = (
  await getMessages(
   type,
   cmd as Parameters<typeof getMessages>[1],
   channel as RChannel,
  )
 )
  .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
  .filter((m) => m.createdTimestamp > Date.now() - 1209600000);
 const messages = amount ? allMessages.slice(0, amount) : allMessages;

 if (!messages.length) {
  if (isCmd) cmd.client.util.errorCmd(cmd, lan.noMessagesFound, language);
  else {
   cmd.client.util.request.channels.addReaction(
    cmd,
    cmd.client.util.constants.standard.getEmoteIdentifier(cmd.client.util.emotes.cross),
   );
  }
  return;
 }

 cmd.client.util
  .getChunks(
   messages.map((m) => m.id),
   100,
  )
  .forEach((c) => {
   cmd.client.util.request.channels.bulkDelete(channel as RChannel, c);
  });

 if (!isCmd) return;

 cmd.editReply({
  content: lan.deleted(messages.length),
  message: '@original',
 });
};

const getMessages = async (
 type: ClearType,
 cmd: Discord.ChatInputCommandInteraction<'cached'> & { channel: RChannel },
 channel: RChannel,
) => {
 switch (type) {
  case 'user':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.author.id === cmd.options.getUser('user', true).id,
   );
  case 'bots':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.author?.bot,
   );
  case 'humans':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => !m.author?.bot,
   );
  case 'audio':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.attachments.some((a) => a.contentType?.startsWith('audio')),
   );
  case 'images':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.attachments.some((a) => a.contentType?.startsWith('image')),
   );
  case 'videos':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.attachments.some((a) => a.contentType?.startsWith('video')),
   );
  case 'files':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => !!m.attachments.size,
   );
  case 'ends-with':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.content.endsWith(cmd.options.getString('content', true)),
   );
  case 'includes':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.content.includes(cmd.options.getString('content', true)),
   );
  case 'invites':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.content.includes('discord.gg/'),
   );
  case 'starts-with':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter((m) =>
    m.content.startsWith(cmd.options.getString('content', true)),
   );
  case 'links':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) =>
     !!m.content.match(cmd.client.util.regexes.urlTester(cmd.client.util.cache.urlTLDs.toArray()))
      ?.length,
   );
  case 'mentions':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) =>
     m.mentions.channels.size ||
     m.mentions.users.filter((u) => m.mentions.repliedUser?.id === u.id).size ||
     m.mentions.roles.size ||
     m.mentions.everyone,
   );
  case 'stickers':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.stickers.size,
   );
  case 'embeds':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.embeds.length,
   );
  case 'text':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.content.length && !m.attachments.size && !m.embeds.length && !m.stickers.size,
   );
  case 'match':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.content.toLowerCase() === cmd.options.getString('content', true).toLowerCase(),
   );
  case 'not-match':
   return (await cmd.client.util.fetchMessages(channel, { amount: 500 })).filter(
    (m) => m.content.toLowerCase() !== cmd.options.getString('content', true).toLowerCase(),
   );
  case 'between': {
   const first = cmd.options.getString('first-message-url', true);
   const second = cmd.options.getString('second-message-url', false);

   const messages = await cmd.client.util.fetchMessages(channel, { amount: 500 });

   const one = first
    ? messages.find(
       (m) => m.url === first.replace('canary.', '').replace('ptb.', '') || m.id === first,
      )
    : channel?.lastMessage;
   const two = second
    ? messages.find(
       (m) => m.url === second.replace('canary.', '').replace('ptb.', '') || m.id === second,
      )
    : one;

   const [start, end] =
    Number(two?.createdTimestamp) < Number(one?.createdTimestamp)
     ? [two ?? undefined, one ?? undefined]
     : [one ?? undefined, two ?? undefined];

   return !start || !end
    ? []
    : messages.filter(
       (m) => m.id !== start.id && m.id !== end.id && m.createdTimestamp > start.createdTimestamp,
      );
  }
  case 'all':
  default: {
   return cmd.client.util.fetchMessages(channel, { amount: 100 });
  }
 }
};

const getAmount = (args: string[]) =>
 Math.round(args.filter((a) => !Number.isNaN(+a)).map((a) => +a)[0] + 1);

const validAmount = (amount: number) => {
 if (amount > 499) return false;
 if (amount < 1) return false;

 return true;
};
