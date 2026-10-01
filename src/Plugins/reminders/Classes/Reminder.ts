import { RequestHandlerError } from '@ayako/api';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 MessageFlags,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import commandMention from '../../../Util/commandMention.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { findFocusedString, getStringOption } from '../../../Util/interactionOptions.js';
import parseDuration from '../../../Util/parseDuration.js';
import type RemindersPlugin from '../Plugin.js';

import DBReminder, { ReminderErrors } from './DBReminder.js';
import { commandName, ReminderOption, ReminderSub } from './Routes.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;

const origin = 'Reminders';
const minDurationMs = 10_000;
const maxListEntries = 20;

const toId = (startTime: unknown) => Number(startTime).toString(36);

export default class Reminder extends DBReminder {
 static async create(
  plugin: RemindersPlugin,
  cmd: APIChatInputApplicationCommandInteraction,
  sub: Sub,
 ) {
  const userId = cmd.member?.user.id ?? cmd.user?.id;
  if (!userId) return;

  const durationMs = parseDuration(getStringOption(sub, ReminderOption.Duration)) ?? 0;
  if (durationMs < minDurationMs) throw new Error(ReminderErrors.tooShort);

  const startTime = Date.now();
  const endTime = startTime + durationMs;

  const reminder = new Reminder(plugin, userId, startTime);
  const row = await reminder.register({
   userId,
   channelId: cmd.channel.id,
   reason: getStringOption(sub, ReminderOption.Content),
   startTime,
   endTime,
  });
  await plugin.engine.arm(row);

  const t = await plugin.t(cmd.guild_id ?? null);
  ephemeralNote.call(
   plugin,
   cmd,
   t.created({ id: toId(startTime), time: `<t:${Math.floor(endTime / 1000)}:R>` }),
  );
 }

 static async list(plugin: RemindersPlugin, cmd: APIChatInputApplicationCommandInteraction) {
  const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';
  const t = await plugin.t(cmd.guild_id ?? null);

  const rows = await plugin.client.db.client.reminder.findMany({
   where: { userId },
   orderBy: { endTime: 'asc' },
  });

  const lines = rows
   .slice(0, maxListEntries)
   .map(
    (row) =>
     `<#${row.channelId}> | <t:${Math.floor(Number(row.endTime) / 1000)}:R> | ` +
     `\`${toId(row.startTime)}\`\n> ${row.reason}`,
   );

  const content = lines.length
   ? lines.join('\n')
   : t.list.none({
      command: await commandMention.call(
       await plugin.getAPI(cmd.guild_id ?? '@me'),
       `${commandName} ${ReminderSub.Create}`,
      ),
     });

  const container = new ContainerBuilder().addTextDisplayComponents(
   new TextDisplayBuilder().setContent([`### ${t.list.title()}`, content].join('\n')),
  );

  new MessagePayload(plugin.client, { origin, reason: 'Reminder list' })
   .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
   .setComponents([container.toJSON()])
   .reply(cmd);
 }

 static async autocomplete(
  plugin: RemindersPlugin,
  cmd: APIApplicationCommandAutocompleteInteraction,
 ) {
  const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';
  const query = findFocusedString(cmd.data.options).toLowerCase();

  const rows = await plugin.client.db.client.reminder.findMany({
   where: { userId },
   orderBy: { endTime: 'asc' },
  });

  const choices = rows
   .map((row) => ({ id: toId(row.startTime), reason: row.reason }))
   .filter((row) => !query || row.id.includes(query) || row.reason.toLowerCase().includes(query))
   .slice(0, 25)
   .map((row) => ({ name: `${row.id} | ${row.reason.slice(0, 80)}`, value: row.id }));

  await plugin.client
   .getBaseAPI()
   .interactions.createAutocompleteResponse(
    cmd.id,
    cmd.token,
    { choices },
    { origin: plugin.name, reason: 'Reminder id autocomplete' },
   );
 }

 async edit(cmd: APIChatInputApplicationCommandInteraction, sub: Sub) {
  const row = await this.get();
  if (!row) throw new Error(ReminderErrors.notFound);

  const updated = await super.edit(cmd, sub, getStringOption(sub, ReminderOption.Content));

  const t = await this.plugin.t(cmd.guild_id ?? null);
  ephemeralNote.call(this.plugin, cmd, t.edited());
  return updated;
 }

 async delete(cmd: APIChatInputApplicationCommandInteraction) {
  const row = await this.get();
  if (!row) throw new Error(ReminderErrors.notFound);

  const deleted = await super.delete(cmd);
  await this.plugin.engine.disarm(this.userId, this.startTime);

  const t = await this.plugin.t(cmd.guild_id ?? null);
  ephemeralNote.call(this.plugin, cmd, t.deleted({ reason: row.reason }));
  return deleted;
 }

 async fire() {
  const row = await this.get();
  if (!row) return;

  const t = await this.plugin.t(null);
  const dm = await this.client.getBaseAPI().users.createDM(this.userId, {
   origin,
   reason: 'Opening DM channel for reminder',
  });

  if (!(dm instanceof RequestHandlerError)) {
   await new MessagePayload(this.client, { origin, reason: 'Reminder ended' })
    .setContent(`${t.ended()}\n>>> ${row.reason}`)
    .addSendTo({ channel: dm.id, guildId: '@me' })
    .send();
  }

  await super.delete();
 }
}
