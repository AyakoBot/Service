import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';

import { StageResult, updateHasContentChange, walkStages, type AutomodStage } from './automodQueue.js';

const message = {} as GatewayMessageCreateDispatchData;

test('walkStages runs every stage while they return Continue', async () => {
 const order: number[] = [];
 const stages: AutomodStage[] = [
  async () => {
   order.push(1);
   return StageResult.Continue;
  },
  async () => {
   order.push(2);
   return StageResult.Continue;
  },
 ];

 await walkStages(stages, message);
 assert.deepEqual(order, [1, 2]);
});

test('walkStages short-circuits after a stage reports Handled', async () => {
 const order: number[] = [];
 const stages: AutomodStage[] = [
  async () => {
   order.push(1);
   return StageResult.Continue;
  },
  async () => {
   order.push(2);
   return StageResult.Handled;
  },
  async () => {
   order.push(3);
   return StageResult.Continue;
  },
 ];

 await walkStages(stages, message);
 assert.deepEqual(order, [1, 2]);
});

test('walkStages treats a throwing stage as Continue and reports it', async () => {
 const order: number[] = [];
 let reported = 0;
 const stages: AutomodStage[] = [
  async () => {
   throw new Error('boom');
  },
  async () => {
   order.push(2);
   return StageResult.Continue;
  },
 ];

 await walkStages(stages, message, () => {
  reported += 1;
 });

 assert.deepEqual(order, [2]);
 assert.equal(reported, 1);
});

test('updateHasContentChange gates on edited_timestamp presence', () => {
 assert.equal(updateHasContentChange({ edited_timestamp: '2026-07-18T00:00:00.000Z' }), true);
 assert.equal(updateHasContentChange({ edited_timestamp: null }), false);
 assert.equal(updateHasContentChange({}), false);
});
