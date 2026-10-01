import type { Reminder as ReminderRow } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { arm, disarm, isArmed, stripMarkerPrefix } from '../../../Util/schedule.js';
import type RemindersPlugin from '../Plugin.js';

import Reminder from './Reminder.js';

const keyPrefix = 'reminders:';

const key = (userId: string, startTime: number) => `${keyPrefix}${userId}:${startTime}`;

const parseKey = (raw: string): { userId: string; startTime: number } | null => {
 if (!raw.startsWith(keyPrefix)) return null;
 const [userId, startTime] = raw.slice(keyPrefix.length).split(':');
 return userId && startTime ? { userId, startTime: Number(startTime) } : null;
};

export default class ReminderEngine {
 plugin: RemindersPlugin;
 client: Client;

 constructor(plugin: RemindersPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 arm = async (reminder: ReminderRow) => {
  await arm.call(
   this.client,
   key(reminder.userId, Number(reminder.startTime)),
   '1',
   (Number(reminder.endTime) - Date.now()) / 1000,
  );
 };

 disarm = async (userId: string, startTime: number) => {
  await disarm.call(this.client, key(userId, startTime));
 };

 fire = (userId: string, startTime: number) =>
  new Reminder(this.plugin, userId, startTime).fire();

 onScheduleExpired = async (rawKey: string) => {
  if (!this.plugin.isEnabled()) return;

  const parsed = parseKey(stripMarkerPrefix(rawKey));
  if (!parsed) return;

  await this.fire(parsed.userId, parsed.startTime).catch((e: Error) =>
   this.plugin.nonFatalError(e, 'scheduled reminder'),
  );
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const rows = await this.client.db.client.reminder.findMany();
  for (const row of rows) {
   if (Number(row.endTime) <= Date.now()) {
    await this.fire(row.userId, Number(row.startTime)).catch((e: Error) =>
     this.plugin.nonFatalError(e, 'reconcile reminder'),
    );
   } else if (!(await isArmed.call(this.client, key(row.userId, Number(row.startTime))))) {
    await this.arm(row);
   }
  }
 };
}
