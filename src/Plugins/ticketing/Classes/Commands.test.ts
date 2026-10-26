import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TicketPriority } from '@ayako/database';
import {
 ApplicationCommandOptionType,
 type APIApplicationCommandStringOption,
} from 'discord-api-types/v10';

import { byUrgency } from '../Util/priority.js';

import { ticketCommand } from './Commands.js';
import { TicketCommandOption, TicketSubcommand } from './Routes.js';

const subcommands = () => ticketCommand().toJSON().options ?? [];

describe('ticketCommand', () => {
 it('declares exactly one subcommand per TicketSubcommand', () => {
  const names = subcommands().map((option) => option.name);
  assert.deepEqual([...names].sort(), Object.values(TicketSubcommand).sort());
  assert.ok(
   subcommands().every((option) => option.type === ApplicationCommandOptionType.Subcommand),
  );
 });

 it('offers every priority as a choice', () => {
  const priority = subcommands().find((option) => option.name === TicketSubcommand.Priority);
  const level =
   priority?.type === ApplicationCommandOptionType.Subcommand
    ? (priority.options?.find((o) => o.name === TicketCommandOption.Level) as
       APIApplicationCommandStringOption | undefined)
    : undefined;

  assert.deepEqual(
   (level?.choices ?? []).map((choice) => choice.value).sort(),
   Object.values(TicketPriority).sort(),
  );
 });
});

describe('byUrgency', () => {
 it('puts higher priorities first and older tickets first within one priority', () => {
  const rows = [
   { id: '3', priority: TicketPriority.None },
   { id: '2', priority: TicketPriority.Urgent },
   { id: '4', priority: TicketPriority.Low },
   { id: '1', priority: TicketPriority.None },
   { id: '5', priority: TicketPriority.Urgent },
  ];

  assert.deepEqual(
   rows.sort(byUrgency).map((row) => row.id),
   ['2', '5', '4', '1', '3'],
  );
 });
});
