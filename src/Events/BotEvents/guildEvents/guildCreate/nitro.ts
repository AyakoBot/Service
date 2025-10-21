import * as Discord from 'discord.js';
import { run } from '../../readyEvents/timedFiles/nitroHandler.js';

export default async (guild: RGuild) => run(guild);
