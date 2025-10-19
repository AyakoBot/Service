import type * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (state: Discord.VoiceState, member?: RMember) => {
 if (!state.channel) return;
 if (!member) return;

 const channels = await state.client.util.getLogChannels('voiceevents', member.guild);
 if (!channels) return;

 const language = await state.client.util.getLanguage(state.guild.id);
 const lan = language.events.logs.voiceState;
 const con = state.client.util.constants.events.logs.voiceState;
 const channelType = state.client.util.getTrueChannelType(state.channel, state.guild);
 const files: Discord.AttachmentPayload[] = [];

 const embed: Discord.APIEmbed = {
  author: {
   name: lan[`${channelType}Join` as keyof typeof lan] as string,
   icon_url: con[`${channelType}Join` as keyof typeof con],
  },
  color: CT.Colors.Success,
  description: lan.descCreate(
   member.user,
   state.channel,
   language.channelTypes[state.channel?.type || 'unknownChannel'],
  ),
  timestamp: new Date().toISOString(),
 };

 const flagsText = [
  state.requestToSpeakTimestamp ? lan.requestToSpeak : null,
  state.serverDeaf ? lan.deaf : null,
  state.serverMute ? lan.mute : null,
  state.selfDeaf ? lan.selfDeaf : null,
  state.selfMute ? lan.selfMute : null,
  state.streaming ? lan.selfStream : null,
  state.selfVideo ? lan.selfVideo : null,
 ]
  .filter((f): f is string => !!f)
  .map((f) => `\`${f}\``)
  .join(', ');

 if (flagsText) {
  embed.fields?.push({
   name: language.t.Flags,
   value: flagsText,
   inline: true,
  });
 }

 state.client.util.send(
  { id: channels, guildId: state.guild.id },
  { embeds: [embed], files },
  10000,
 );
};
