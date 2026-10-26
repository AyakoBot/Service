import { RequestHandlerError } from '@ayako/api';
import { TicketState } from '@ayako/database';

import getUser from '../../../Util/getUser.js';
import type ChannelTicket from '../Classes/ChannelTicket.js';

import { priorityLabel } from './priority.js';
import { systemDisplayLabel } from './systemLabel.js';
import { NameVar, defaultNameTemplate, usedNameVars, type NameValues } from './ticketName.js';

export interface NameOverrides {
 state?: string;
 username?: string;
 staffId?: string | null;
 tierId?: string | null;
}

const once = <T>(load: () => Promise<T>) => {
 let cached: Promise<T> | undefined;
 return () => (cached ??= load());
};

const userOf = async function (this: ChannelTicket, userId: string) {
 const user = await getUser.call(this.client, userId);
 return user && !(user instanceof RequestHandlerError) ? user : null;
};

export const nameValues = async function (
 this: ChannelTicket,
 template: string,
 overrides: NameOverrides,
): Promise<NameValues> {
 const ticket = await this.getTicket();
 const t = await this.plugin.t(ticket.settings.guild);

 const prepared = ticket.state === TicketState.prepared ? ticket.opener : null;
 const staffId = overrides.staffId === undefined ? (ticket.claimer ?? prepared) : overrides.staffId;
 const tierId =
  overrides.tierId === undefined
   ? ticket.tierId
     ? String(ticket.tierId)
     : null
   : overrides.tierId;
 const creator = once(() => userOf.call(this, ticket.user));

 const state = (): string => {
  if (overrides.state) return overrides.state;
  if (ticket.state === TicketState.closed) return t.closed();
  return staffId ? t.claimed() : t.opened();
 };

 const resolvers: Record<NameVar, () => Promise<string>> = {
  [NameVar.State]: async () => state(),
  [NameVar.User]: async () => overrides.username ?? (await creator())?.username ?? '',
  [NameVar.Display]: async () => {
   const member = await this.client.cache.members.get(ticket.settings.guild, ticket.user);
   const user = await creator();
   return member?.nick || user?.global_name || overrides.username || user?.username || '';
  },
  [NameVar.UserId]: async () => ticket.user,
  [NameVar.Staff]: async () =>
   staffId ? ((await userOf.call(this, staffId))?.username ?? staffId) : t.nameNone(),
  [NameVar.StaffId]: async () => staffId ?? t.nameNone(),
  [NameVar.System]: async () => systemDisplayLabel(t, ticket.settings),
  [NameVar.Tier]: async () => (await this.getTier(tierId))?.name ?? t.nameNone(),
  [NameVar.Priority]: async () => priorityLabel(t, ticket.priority),
  [NameVar.Id]: async () => String(ticket.id),
  [NameVar.Date]: async () => new Date(Number(ticket.id)).toISOString().slice(0, 10),
 };

 const entries = await Promise.all(
  usedNameVars(template + defaultNameTemplate).map(
   async (key) => [key, await resolvers[key]()] as const,
  ),
 );

 return Object.fromEntries(entries);
};
