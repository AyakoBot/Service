import * as Discord from 'discord.js';
import { stoppedBoosting } from '../guildMemberUpdate/nitro.js';

export default async (member: RMember) => {
 if (!member.premiumSinceTimestamp) return;

 stoppedBoosting(member);
};
