import { PermissionFlagsBits } from '@discordjs/core';
import type { APIInteraction } from 'discord-api-types/v10';

import { GiveawayErrors } from '../Classes/DBGiveaway.js';

export default (cmd: APIInteraction) => {
 if (!(BigInt(cmd.member?.permissions ?? '0') & PermissionFlagsBits.ManageGuild)) {
  throw new Error(GiveawayErrors.youNoPerms);
 }
};
