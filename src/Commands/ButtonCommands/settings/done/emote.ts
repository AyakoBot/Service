import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (cmd: Discord.ButtonInteraction, args: string[], multi: boolean = false) => {
 if (!cmd.inCachedGuild()) return;

 const settingName = args.shift() as CT.SettingNames;
 if (!settingName) return;

 const fieldName = args.shift();
 if (!fieldName) return;

 const getUniquetimestamp = () => {
  const arg = args.shift();
  if (arg) return Number(arg);
  return undefined;
 };
 const uniquetimestamp = getUniquetimestamp();

 const currentSetting = await cmd.client.util.settingsHelpers.changeHelpers.get(
  settingName,
  cmd.guildId,
  uniquetimestamp,
 );

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lastMessage = cmd.channel
  ? (cmd.channel.lastMessage ??
    (await cmd.client.util.request.channels.getMessages(cmd.channel, { limit: 1 })))
  : undefined;

 if (cmd.channel?.type === Discord.ChannelType.PrivateThread) {
  cmd.client.util.request.channels.delete(cmd.channel);
 }

 if (!lastMessage || 'message' in lastMessage) {
  cmd.client.util.errorCmd(cmd, language.errors.messageNotFound, language);
  return;
 }

 const emoteMessage = Array.isArray(lastMessage) ? lastMessage[0] : lastMessage;
 const emoteContent = emoteMessage?.author.bot ? undefined : emoteMessage?.content;

 const emotes = emoteContent
  ?.split(/\s+/g)
  .filter((emote) => !!emote.length)
  .map((emote) =>
   emote.match(cmd.client.util.regexes.emojiTester)?.length
    ? { identifier: emote.trim() }
    : { identifier: emote.replace(/<:/g, '').replace(/</g, '').replace(/>/g, '') },
  );

 const validEmotes = emotes?.filter((emote) => {
  if (
   emote.identifier.includes(':') &&
   !emote.identifier.match(cmd.client.util.regexes.emojiTester)?.length
  ) {
   return [2, 3].includes(emote.identifier.split(/:/g).length);
  }

  return !(
   emote.identifier.match(cmd.client.util.regexes.emojiTester)?.length &&
   emote.identifier.match(/\w/g)?.length
  );
 });

 const insertEmotes =
  (multi && validEmotes ? validEmotes.map((e) => e.identifier) : validEmotes?.[0]?.identifier) ??
  null;
 if (!insertEmotes) return;

 const updatedSetting = await cmd.client.util.settingsHelpers.changeHelpers.getAndInsert(
  settingName,
  fieldName,
  cmd.guildId,
  insertEmotes,
  uniquetimestamp,
 );

 cmd.client.util.settingsHelpers.updateLog(
  { [fieldName]: currentSetting?.[fieldName as keyof typeof currentSetting] },
  { [fieldName]: updatedSetting?.[fieldName as keyof typeof updatedSetting] },
  fieldName as Parameters<(typeof cmd.client.util)['settingsHelpers']['updateLog']>[2],
  settingName,
  uniquetimestamp,
  cmd.guild,
  language,
  language.slashCommands.settings.categories[settingName],
 );
};
