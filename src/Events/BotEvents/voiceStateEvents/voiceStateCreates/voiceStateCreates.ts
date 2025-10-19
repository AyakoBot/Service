import type * as Discord from 'discord.js';
import log from './log.js';
import voiceHub from './voiceHub.js';
import voiceQueue from './voiceQueue.js';

export default async (state: Discord.VoiceState, member?: RMember) => {
 log(state, member);
 voiceQueue(state, member);
 voiceHub(state, member);
};
