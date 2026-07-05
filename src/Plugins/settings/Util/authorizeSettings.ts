import { PermissionFlagsBits } from 'discord-api-types/v10';

export const hasManageGuild = (permissions: bigint | string | null | undefined): boolean => {
 if (!permissions) return false;
 const bits = BigInt(permissions);
 const required = PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator;
 return (bits & required) !== 0n;
};
