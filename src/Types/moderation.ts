// import { StoredPunishmentTypes } from '@ayako/database';
import type { RChannel, RGuild, RMessage, RRole, RUser } from '@ayako/utility';
import type { DiscordAPIError } from '@discordjs/rest';

import { Colors } from './index.js';

export enum ModTypes {
 RoleAdd = 'roleAdd',
 RoleRemove = 'roleRemove',
 TempMuteAdd = 'tempMuteAdd',
 MuteRemove = 'muteRemove',
 BanAdd = 'banAdd',
 BanRemove = 'banRemove',
 SoftBanAdd = 'softBanAdd',
 TempBanAdd = 'tempBanAdd',
 ChannelBanAdd = 'channelBanAdd',
 TempChannelBanAdd = 'tempChannelBanAdd',
 ChannelBanRemove = 'channelBanRemove',
 KickAdd = 'kickAdd',
 WarnAdd = 'warnAdd',
 SoftWarnAdd = 'softWarnAdd',
 StrikeAdd = 'strikeAdd',
 UnAfk = 'unAfk',
 VcMuteAdd = 'vcMuteAdd',
 VcTempMuteAdd = 'vcTempMuteAdd',
 VcMuteRemove = 'vcMuteRemove',
 VcDeafenAdd = 'vcDeafenAdd',
 VcTempDeafenAdd = 'vcTempDeafenAdd',
 VcDeafenRemove = 'vcDeafenRemove',
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const DestructiveModTypes = [
 ModTypes.BanAdd,
 ModTypes.KickAdd,
 ModTypes.SoftBanAdd,
 ModTypes.TempBanAdd,
];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ModColors: Record<ModTypes, Colors> = {
 [ModTypes.RoleAdd]: Colors.Success,
 [ModTypes.RoleRemove]: Colors.Danger,
 [ModTypes.TempMuteAdd]: Colors.Success,
 [ModTypes.MuteRemove]: Colors.Danger,
 [ModTypes.BanAdd]: Colors.Danger,
 [ModTypes.BanRemove]: Colors.Success,
 [ModTypes.SoftBanAdd]: Colors.Danger,
 [ModTypes.TempBanAdd]: Colors.Danger,
 [ModTypes.ChannelBanAdd]: Colors.Danger,
 [ModTypes.TempChannelBanAdd]: Colors.Danger,
 [ModTypes.ChannelBanRemove]: Colors.Success,
 [ModTypes.KickAdd]: Colors.Danger,
 [ModTypes.WarnAdd]: Colors.Danger,
 [ModTypes.SoftWarnAdd]: Colors.Danger,
 [ModTypes.StrikeAdd]: Colors.Danger,
 [ModTypes.UnAfk]: Colors.Success,
 [ModTypes.VcMuteAdd]: Colors.Danger,
 [ModTypes.VcTempMuteAdd]: Colors.Danger,
 [ModTypes.VcMuteRemove]: Colors.Success,
 [ModTypes.VcDeafenAdd]: Colors.Danger,
 [ModTypes.VcTempDeafenAdd]: Colors.Danger,
 [ModTypes.VcDeafenRemove]: Colors.Success,
};

export type BaseOptions = {
 reason: string;
 dbOnly: boolean;
 guild: RGuild;
 target: RUser;
 executor: RUser;
 skipChecks: boolean;
 dm?: RMessage | DiscordAPIError | Error;
};

type Channel = { channel: RChannel };
type Roles = { roles: RRole[] };
type Temp = { duration: number };
type Empty = NonNullable<unknown>;
type DeleteMessageSeconds = { deleteMessageSeconds: number };

type SpecificOpts = {
 [ModTypes.RoleAdd]: Roles;
 [ModTypes.RoleRemove]: Roles;
 [ModTypes.TempMuteAdd]: Temp;
 [ModTypes.MuteRemove]: Empty;
 [ModTypes.BanAdd]: DeleteMessageSeconds;
 [ModTypes.SoftBanAdd]: DeleteMessageSeconds;
 [ModTypes.TempBanAdd]: Temp & DeleteMessageSeconds;
 [ModTypes.ChannelBanAdd]: Channel;
 [ModTypes.TempChannelBanAdd]: Channel & Temp;
 [ModTypes.ChannelBanRemove]: Channel;
 [ModTypes.BanRemove]: Empty;
 [ModTypes.KickAdd]: Empty;
 [ModTypes.WarnAdd]: Empty;
 [ModTypes.SoftWarnAdd]: Empty;
 [ModTypes.StrikeAdd]: Empty;
 [ModTypes.UnAfk]: Empty;
 [ModTypes.VcMuteAdd]: Empty;
 [ModTypes.VcTempMuteAdd]: Temp;
 [ModTypes.VcMuteRemove]: Empty;
 [ModTypes.VcDeafenAdd]: Empty;
 [ModTypes.VcTempDeafenAdd]: Temp;
 [ModTypes.VcDeafenRemove]: Empty;
};

type SpecificOptions = { [K in ModTypes]: SpecificOpts[K] };

export type ModOptions<T extends ModTypes> = BaseOptions & SpecificOptions[T];

export enum PunishmentType {
 Warn = 'warn',
 Kick = 'kick',
 Mute = 'mute',
 Tempmute = 'tempmute',
 Ban = 'ban',
 Tempban = 'tempban',
 Channelban = 'channelban',
 Tempchannelban = 'tempchannelban',
 Softban = 'softban',
 VCMute = 'vcmute',
 VCDeaf = 'vcdeaf',
 VCTempMute = 'vctempmute',
 VCTempDeaf = 'vctempdeaf',
}

// export const ModType2StoredPunishmentTypes: Record<ModTypes, StoredPunishmentTypes> = {
//  [ModTypes.VcDeafenAdd]: StoredPunishmentTypes.vcdeaf,
//  [ModTypes.VcTempDeafenAdd]: StoredPunishmentTypes.vctempdeaf,
//  [ModTypes.VcDeafenRemove]: StoredPunishmentTypes.vcdeaf,
//  [ModTypes.TempMuteAdd]: StoredPunishmentTypes.tempmute,
//  [ModTypes.MuteRemove]: StoredPunishmentTypes.tempmute,
//  [ModTypes.BanAdd]: StoredPunishmentTypes.ban,
//  [ModTypes.BanRemove]: StoredPunishmentTypes.ban,
//  [ModTypes.SoftBanAdd]: StoredPunishmentTypes.softban,
//  [ModTypes.TempBanAdd]: StoredPunishmentTypes.tempban,
//  [ModTypes.ChannelBanRemove]: StoredPunishmentTypes.channelban,
//  [ModTypes.ChannelBanAdd]: StoredPunishmentTypes.channelban,
//  [ModTypes.TempChannelBanAdd]: StoredPunishmentTypes.tempchannelban,
//  [ModTypes.KickAdd]: StoredPunishmentTypes.kick,
//  [ModTypes.WarnAdd]: StoredPunishmentTypes.warn,
//  [ModTypes.VcMuteAdd]: StoredPunishmentTypes.vcmute,
//  [ModTypes.VcTempMuteAdd]: StoredPunishmentTypes.vctempmute,
//  [ModTypes.VcMuteRemove]: StoredPunishmentTypes.vcmute,
//  [ModTypes.StrikeAdd]: StoredPunishmentTypes.warn,
//  [ModTypes.UnAfk]: StoredPunishmentTypes.warn,
//  [ModTypes.SoftWarnAdd]: StoredPunishmentTypes.warn,
//  [ModTypes.RoleAdd]: StoredPunishmentTypes.warn,
//  [ModTypes.RoleRemove]: StoredPunishmentTypes.warn,
// };

// export const PunishmentType2StoredPunishmentTypes:
// Record<PunishmentType, StoredPunishmentTypes> = {
//  [PunishmentType.Kick]: StoredPunishmentTypes.kick,
//  [PunishmentType.Warn]: StoredPunishmentTypes.warn,
//  [PunishmentType.Mute]: StoredPunishmentTypes.mute,
//  [PunishmentType.Tempmute]: StoredPunishmentTypes.tempmute,
//  [PunishmentType.Ban]: StoredPunishmentTypes.ban,
//  [PunishmentType.Tempban]: StoredPunishmentTypes.tempban,
//  [PunishmentType.Channelban]: StoredPunishmentTypes.channelban,
//  [PunishmentType.Tempchannelban]: StoredPunishmentTypes.tempchannelban,
//  [PunishmentType.Softban]: StoredPunishmentTypes.softban,
//  [PunishmentType.VCMute]: StoredPunishmentTypes.vcmute,
//  [PunishmentType.VCDeaf]: StoredPunishmentTypes.vcdeaf,
//  [PunishmentType.VCTempMute]: StoredPunishmentTypes.vcmute,
//  [PunishmentType.VCTempDeaf]: StoredPunishmentTypes.vcdeaf,
// };

// export const StoredTempTypes = [
//  StoredPunishmentTypes.tempban,
//  StoredPunishmentTypes.tempchannelban,
//  StoredPunishmentTypes.tempmute,
//  StoredPunishmentTypes.vctempdeaf,
//  StoredPunishmentTypes.vctempmute,
// ];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const StoredBaseAndTempType = {
 // [StoredPunishmentTypes.ban]: [StoredPunishmentTypes.ban, StoredPunishmentTypes.tempban],
 // [StoredPunishmentTypes.channelban]: [
 //  StoredPunishmentTypes.channelban,
 //  StoredPunishmentTypes.tempchannelban,
 // ],
 // [StoredPunishmentTypes.mute]: [StoredPunishmentTypes.mute, StoredPunishmentTypes.tempmute],
 // [StoredPunishmentTypes.vcdeaf]:
 // [StoredPunishmentTypes.vcdeaf, StoredPunishmentTypes.vctempdeaf],
 // [StoredPunishmentTypes.vcmute]:
 // [StoredPunishmentTypes.vcmute, StoredPunishmentTypes.vctempmute],
 // [StoredPunishmentTypes.kick]: [StoredPunishmentTypes.kick],
 // [StoredPunishmentTypes.warn]: [StoredPunishmentTypes.warn],
 // [StoredPunishmentTypes.tempmute]: [StoredPunishmentTypes.tempmute],
 // [StoredPunishmentTypes.tempban]: [StoredPunishmentTypes.tempban],
 // [StoredPunishmentTypes.tempchannelban]: [StoredPunishmentTypes.tempchannelban],
 // [StoredPunishmentTypes.softban]: [StoredPunishmentTypes.softban],
 // [StoredPunishmentTypes.vctempdeaf]: [StoredPunishmentTypes.vctempdeaf],
 // [StoredPunishmentTypes.vctempmute]: [StoredPunishmentTypes.vctempmute],
};
