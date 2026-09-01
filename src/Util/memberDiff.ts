/* eslint-disable @typescript-eslint/naming-convention */
import { serialize, type RMember } from '@ayako/utility';
import type { APIGuildMember, GatewayGuildMemberUpdateDispatchData } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

import { previousSnapshot, sortTimesDescending } from './previousSnapshot.js';

export interface MemberDiff {
 previous: RMember | null;
 addedRoles: string[];
 removedRoles: string[];
 rolesChanged: boolean;
 boostStarted: boolean;
 boostEnded: boolean;
}

export interface MemberRoleState {
 roles: string[];
 premium_since?: string | null;
}

export { sortTimesDescending };

const sameRoleState = (a: MemberRoleState, b: MemberRoleState): boolean =>
 (a.premium_since ?? null) === (b.premium_since ?? null) &&
 [...a.roles].sort().join(',') === [...b.roles].sort().join(',');

export const previousSnapshotTime = (
 times: number[],
 newest: MemberRoleState | null,
 incoming: MemberRoleState,
): number | null => {
 if (!times.length || !newest) return null;
 if (!sameRoleState(newest, incoming)) return times[0];
 return times.length > 1 ? times[1] : null;
};

export const memberDelta = (
 previous: MemberRoleState | null,
 next: MemberRoleState,
): Omit<MemberDiff, 'previous'> => {
 if (!previous) {
  return {
   addedRoles: [],
   removedRoles: [],
   rolesChanged: false,
   boostStarted: false,
   boostEnded: false,
  };
 }

 const addedRoles = next.roles.filter((r) => !previous.roles.includes(r));
 const removedRoles = previous.roles.filter((r) => !next.roles.includes(r));
 const wasBoosting = !!previous.premium_since;
 const isBoosting = !!next.premium_since;

 return {
  addedRoles,
  removedRoles,
  rolesChanged: !!addedRoles.length || !!removedRoles.length,
  boostStarted: !wasBoosting && isBoosting,
  boostEnded: wasBoosting && !isBoosting,
 };
};

export const previousMemberTimes = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<number[]> {
 return sortTimesDescending(await this.cache.members.getTimes(guildId, userId));
};

const previousMemberSnapshot = async function (
 this: Client,
 data: GatewayGuildMemberUpdateDispatchData,
): Promise<RMember | null> {
 const times = await previousMemberTimes.call(this, data.guild_id, data.user.id);
 if (!times.length) return null;

 const newest = await this.cache.members.getAt(times[0], data.guild_id, data.user.id);
 const time = previousSnapshotTime(times, newest, data);

 if (time === null) return null;
 if (time === times[0]) return newest;

 return this.cache.members.getAt(time, data.guild_id, data.user.id);
};

export const memberDiff = async function (
 this: Client,
 data: GatewayGuildMemberUpdateDispatchData,
): Promise<MemberDiff> {
 const previous = await previousMemberSnapshot.call(this, data);
 return { previous, ...memberDelta(previous, data) };
};

export const leftMemberSnapshot = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<RMember | null> {
 const times = await previousMemberTimes.call(this, guildId, userId);
 if (!times.length) return null;

 return this.cache.members.getAt(times[0], guildId, userId);
};

const normalisedMember = (data: GatewayGuildMemberUpdateDispatchData): APIGuildMember =>
 ({
  ...data,
  deaf: data.deaf || false,
  mute: data.mute || false,
  flags: data.flags || 0,
 }) as APIGuildMember;

const comparableMember = (member: RMember): string => serialize({ ...member, joined_at: null });

export const memberProjectionSnapshot = async function (
 this: Client,
 data: GatewayGuildMemberUpdateDispatchData,
): Promise<RMember | null> {
 const cache = this.cache.members;

 return previousSnapshot({
  cache,
  ids: [data.guild_id, data.user.id],
  incoming: normalisedMember(data),
  apiArgs: [data.guild_id],
  same: (newest, incoming) =>
   comparableMember(newest) === comparableMember(cache.apiToR(incoming, data.guild_id)),
 });
};
