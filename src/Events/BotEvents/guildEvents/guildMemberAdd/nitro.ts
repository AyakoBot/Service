import * as Discord from 'discord.js';
import { startedBoosting } from '../guildMemberUpdate/nitro.js';

// I don't think this will ever happen, but let's handle it anyways
export default async (member: RMember) => {
 if (!member.premiumSinceTimestamp) return;

 startedBoosting(member);
};
