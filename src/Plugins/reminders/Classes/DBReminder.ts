import type { Reminder as ReminderRow } from '@ayako/database';
import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type { CreateData } from '../../../Types/prisma.js';
import type RemindersPlugin from '../Plugin.js';

/* eslint-disable @typescript-eslint/naming-convention */
export enum ReminderErrors {
 notFound = 'notFound',
 tooShort = 'tooShort',
}
/* eslint-enable @typescript-eslint/naming-convention */

export default abstract class DBReminder {
 plugin: RemindersPlugin;
 userId: string;
 startTime: number;
 protected client: Client;

 constructor(plugin: RemindersPlugin, userId: string, startTime: number) {
  this.client = plugin.client;
  this.plugin = plugin;
  this.userId = userId;
  this.startTime = startTime;
 }

 get(): Promise<ReminderRow | null> {
  return this.client.db.client.reminder.findFirst({
   where: { userId: this.userId, startTime: this.startTime },
  });
 }

 register(data: CreateData<'reminder'>): Promise<ReminderRow> {
  return this.client.db.client.reminder.create({ data });
 }

 edit(
  _cmd: APIChatInputApplicationCommandInteraction,
  _sub: APIApplicationCommandInteractionDataSubcommandOption,
  reason: string,
 ): Promise<ReminderRow> {
  return this.client.db.client.reminder.update({
   where: { startTime: this.startTime },
   data: { reason },
  });
 }

 delete(_cmd?: APIChatInputApplicationCommandInteraction): Promise<ReminderRow> {
  return this.client.db.client.reminder.delete({ where: { startTime: this.startTime } });
 }
}
