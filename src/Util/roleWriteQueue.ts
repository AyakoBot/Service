import { inspect } from 'node:util';

import { RequestHandlerError } from '@ayako/api';

import type Client from '../Classes/Client.js';

import {
 partitionRoles,
 roleWriteContext,
 type BotRoleContext,
 type RoleIndex,
} from './roleHierarchy.js';

export enum RoleWritePriority {
 Interactive = 0,
 Automation = 1,
 Bulk = 2,
}

export interface RoleWriteRequest {
 guildId: string;
 userId: string;
 add?: string[];
 remove?: string[];
 reason: string;
 priority?: RoleWritePriority;
}

export enum RoleWriteRefusal {
 QueueFull = 'queue-full',
 NoPermission = 'no-permission',
}

export const maxQueueDepthPerGuild = 2000;
export const flushInterval = 250;

const ROLE_WRITE_ORIGIN = 'RoleWriteQueue';

export interface RoleWriteJob {
 guildId: string;
 userId: string;
 add: Set<string>;
 remove: Set<string>;
 reason: string;
 priority: RoleWritePriority;
 enqueuedAt: number;
}

export interface TargetRolesInput {
 guildId: string;
 current: string[];
 add: string[];
 remove: string[];
 index: RoleIndex;
 bot: BotRoleContext;
}

export const compareJobs = (a: RoleWriteJob, b: RoleWriteJob): number =>
 a.priority - b.priority || a.enqueuedAt - b.enqueuedAt;

const sortedKey = (roleIds: string[]): string => [...new Set(roleIds)].sort().join(',');

export const memoKey = (input: Pick<TargetRolesInput, 'current' | 'add' | 'remove'>): string =>
 [sortedKey(input.current), sortedKey(input.add), sortedKey(input.remove)].join('|');

export const sameRoleSet = (a: string[], b: string[]): boolean => sortedKey(a) === sortedKey(b);

export const computeTargetRoles = (input: TargetRolesInput): string[] => {
 const base = { guildId: input.guildId, index: input.index, bot: input.bot };
 const { ok: adds } = partitionRoles({ ...base, roleIds: input.add });
 const { ok: removes } = partitionRoles({ ...base, roleIds: input.remove });

 const target = new Set(input.current);
 adds.forEach((roleId) => target.add(roleId));
 removes.forEach((roleId) => target.delete(roleId));
 target.delete(input.guildId);

 return [...target];
};

export const targetRolesMemoised = (
 memo: Map<string, string[]>,
 input: TargetRolesInput,
): string[] => {
 const key = memoKey(input);
 const hit = memo.get(key);
 if (hit) return hit;

 const target = computeTargetRoles(input);
 memo.set(key, target);

 return target;
};

const mergeRequest = (job: RoleWriteJob, req: RoleWriteRequest) => {
 req.add?.forEach((roleId) => {
  job.remove.delete(roleId);
  job.add.add(roleId);
 });

 req.remove?.forEach((roleId) => {
  job.add.delete(roleId);
  job.remove.add(roleId);
 });

 const priority = req.priority ?? RoleWritePriority.Automation;
 if (priority > job.priority) return;

 job.priority = priority;
 job.reason = req.reason;
};

export default class RoleWriteQueue {
 private client: Client;
 private queues: Map<string, Map<string, RoleWriteJob>> = new Map();
 private timers: Map<string, NodeJS.Timeout> = new Map();
 private draining: Set<string> = new Set();
 private held: Set<string> = new Set();

 constructor(client: Client) {
  this.client = client;
 }

 enqueue = (req: RoleWriteRequest): RoleWriteRefusal | null => {
  const queue = this.queues.get(req.guildId) ?? new Map<string, RoleWriteJob>();
  const existing = queue.get(req.userId);

  if (!existing && queue.size >= maxQueueDepthPerGuild) return RoleWriteRefusal.QueueFull;

  const job = existing ?? {
   guildId: req.guildId,
   userId: req.userId,
   add: new Set<string>(),
   remove: new Set<string>(),
   reason: req.reason,
   priority: req.priority ?? RoleWritePriority.Automation,
   enqueuedAt: Date.now(),
  };

  mergeRequest(job, req);
  queue.set(req.userId, job);
  this.queues.set(req.guildId, queue);
  this.arm(req.guildId);

  return null;
 };

 depth = (guildId: string): number => this.queues.get(guildId)?.size ?? 0;

 pending = (guildId: string, userId: string): RoleWriteJob | undefined =>
  this.queues.get(guildId)?.get(userId);

 drain = async (guildId: string): Promise<void> => {
  if (this.draining.has(guildId)) return;

  const queue = this.queues.get(guildId);
  if (!queue?.size) {
   this.settle(guildId);
   return;
  }

  this.draining.add(guildId);
  return this.flush(guildId, queue).finally(() => this.draining.delete(guildId));
 };

 private arm = (guildId: string) => {
  if (this.timers.has(guildId)) return;

  const timer = setInterval(() => void this.drain(guildId), flushInterval);
  timer.unref();
  this.timers.set(guildId, timer);
 };

 private settle = (guildId: string) => {
  if (this.queues.get(guildId)?.size) return;

  const timer = this.timers.get(guildId);
  if (timer) clearInterval(timer);

  this.timers.delete(guildId);
  this.queues.delete(guildId);
 };

 private flush = async (guildId: string, queue: Map<string, RoleWriteJob>): Promise<void> => {
  const api = await this.client.getAPI(guildId);
  const permitted = await api.guilds.util.canManageRoles(guildId);

  if (!permitted.response) {
   if (!this.held.has(guildId)) {
    this.held.add(guildId);
    this.report(guildId, `${RoleWriteRefusal.NoPermission}: ${permitted.message}`);
   }
   return;
  }

  this.held.delete(guildId);

  const { index, bot } = await roleWriteContext.call(this.client, guildId, api.botId);
  const context = { index, bot: { position: bot.position, canManageRoles: permitted.response } };
  const memo = new Map<string, string[]>();

  for (const job of [...queue.values()].sort(compareJobs)) {
   queue.delete(job.userId);
   await this.apply(api, job, context, memo);
  }

  this.settle(guildId);
 };

 private apply = async (
  api: Awaited<ReturnType<Client['getAPI']>>,
  job: RoleWriteJob,
  context: { index: RoleIndex; bot: BotRoleContext },
  memo: Map<string, string[]>,
 ): Promise<void> => {
  const member = await this.client.cache.members.get(job.guildId, job.userId);
  if (!member) return;

  const roles = targetRolesMemoised(memo, {
   guildId: job.guildId,
   current: member.roles,
   add: [...job.add],
   remove: [...job.remove],
   index: context.index,
   bot: context.bot,
  });

  if (sameRoleSet(member.roles, roles)) return;

  const res = await api.guilds.editMember(
   job.guildId,
   job.userId,
   { roles },
   { origin: ROLE_WRITE_ORIGIN, reason: job.reason },
  );

  if (res instanceof RequestHandlerError) {
   this.report(job.guildId, `editMember for ${job.userId} failed: ${inspect(res)}`);
  }
 };

 private report = (guildId: string, context: string) =>
  this.client.logger.error(`[RoleWriteQueue] ${context} in guild ${guildId}`);
}
