import {
 PermissionFlagsBits,
 type APIChatInputApplicationCommandGuildInteraction,
 type APIMessageComponentButtonInteraction,
} from 'discord-api-types/v10';
import permError from '../permError';

export default (
 cmd: APIChatInputApplicationCommandGuildInteraction | APIMessageComponentButtonInteraction,
 permissions: bigint = PermissionFlagsBits.ManageGuild,
): boolean => {
 if ((BigInt(cmd.member?.permissions || 0n) & permissions) !== permissions) {
  permError(cmd, permissions, false, false);
  return false;
 }
 return true;
};
