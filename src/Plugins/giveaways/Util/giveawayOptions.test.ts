import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
 ApplicationCommandOptionType,
 type APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import { GiveawayErrors } from '../Classes/DBGiveaway.js';
import { GiveawayOption, GiveawaySub } from '../Classes/Routes.js';

import { readOptions, toRowData } from './giveawayOptions.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;
type BasicOption = NonNullable<Sub['options']>[number];

const sub = (options?: BasicOption[]): Sub => ({
 name: GiveawaySub.Quick,
 type: ApplicationCommandOptionType.Subcommand,
 options,
});

const stringOption = (name: GiveawayOption, value: string): BasicOption => ({
 name,
 type: ApplicationCommandOptionType.String,
 value,
});

const integerOption = (name: GiveawayOption, value: number): BasicOption => ({
 name,
 type: ApplicationCommandOptionType.Integer,
 value,
});

const roleOption = (name: GiveawayOption, value: string): BasicOption => ({
 name,
 type: ApplicationCommandOptionType.Role,
 value,
});

const booleanOption = (name: GiveawayOption, value: boolean): BasicOption => ({
 name,
 type: ApplicationCommandOptionType.Boolean,
 value,
});

const rowData = (options: Parameters<typeof toRowData>[0]) =>
 toRowData(options) as Record<string, unknown>;

const everyMappedOption = {
 time: '1h',
 claimTimeout: '2h',
 role: '777',
 winners: 3,
};

describe('readOptions', () => {
 it('returns a key only for options actually present on the subcommand', () => {
  const options = readOptions(sub([stringOption(GiveawayOption.Description, 'A prize')]));

  assert.deepEqual(Object.keys(options), ['description']);
  assert.equal('time' in options, false);
  assert.equal('winners' in options, false);
  assert.equal('prize' in options, false);
 });

 it('returns nothing at all for an empty or absent option list', () => {
  assert.deepEqual(Object.keys(readOptions(sub([]))), []);
  assert.deepEqual(Object.keys(readOptions(sub())), []);
 });

 it('reads every present option at its declared type', () => {
  const options = readOptions(
   sub([
    stringOption(GiveawayOption.Description, 'A prize'),
    integerOption(GiveawayOption.Winners, 3),
    roleOption(GiveawayOption.Role, '777'),
    booleanOption(GiveawayOption.FailReroll, true),
   ]),
  );

  assert.deepEqual([...Object.keys(options)].sort(), [
   'description',
   'failReroll',
   'role',
   'winners',
  ]);
  assert.equal(options.description, 'A prize');
  assert.equal(options.winners, 3);
  assert.equal(options.role, '777');
  assert.equal(options.failReroll, true);
 });
});

describe('toRowData', () => {
 it('maps every option name onto its column name', () => {
  const data = rowData(everyMappedOption);

  assert.ok(data.endTime instanceof Date);
  assert.ok(Math.abs((data.endTime as Date).getTime() - Date.now() - 3600000) < 5000);
  assert.equal(data.collectSeconds, 7200);
  assert.deepEqual(data.requiredRoles, ['777']);
  assert.equal(data.winnerCount, 3);
 });

 it('never leaks an option name into the row', () => {
  const data = rowData(everyMappedOption);
  const leaked = Object.keys(everyMappedOption).filter((key) => key in data);

  assert.deepEqual(leaked, []);
 });

 it('returns an empty object for empty options', () => {
  assert.deepEqual(rowData({}), {});
 });

 it('defaults a cleared winner count to one and clears the required role', () => {
  assert.equal(rowData({ winners: null }).winnerCount, 1);
  assert.deepEqual(rowData({ role: null }).requiredRoles, []);
 });

 it('clears a claiming timeout written as an empty string or "none"', () => {
  assert.equal(rowData({ claimTimeout: 'none' }).collectSeconds, null);
  assert.equal(rowData({ claimTimeout: '   ' }).collectSeconds, null);
 });

 it('rejects an unreadable duration', () => {
  assert.throws(() => toRowData({ time: 'not a duration' }), {
   message: GiveawayErrors.invalidTime,
  });
  assert.throws(() => toRowData({ claimTimeout: 'gibberish' }), {
   message: GiveawayErrors.invalidTime,
  });
 });

 it('rejects a claiming timeout under one hour and accepts exactly one hour', () => {
  assert.throws(() => toRowData({ claimTimeout: '30m' }), {
   message: GiveawayErrors.collectTooShort,
  });
  assert.equal(rowData({ claimTimeout: '1h' }).collectSeconds, 3600);
 });
});
