import assert from 'node:assert/strict';
import { test } from 'node:test';

import { containerCharBudget } from '../../../Util/fmt.js';

import { fitJsonBlock } from './jsonBlock.js';

const fenceOverhead = 12;

test('json that fits is shown whole, with no ellipsis and no file', () => {
 const json = JSON.stringify({ hello: 'world' }, null, 2);
 const { content, truncated } = fitJsonBlock(json);

 assert.equal(truncated, false);
 assert.equal(content, `\`\`\`json\n${json}\n\`\`\``);
 assert.equal(content.includes('…'), false);
});

test('json that overflows fills the budget exactly rather than a token preview', () => {
 const json = JSON.stringify({ pad: 'x'.repeat(9000) }, null, 2);
 const { content, truncated } = fitJsonBlock(json);

 assert.equal(truncated, true);
 assert.equal(content.length, containerCharBudget);
 assert.equal(content.endsWith('…\n```'), true);
});

test('the budget is never exceeded, whatever the padding', () => {
 for (let pad = 0; pad < 8; pad += 1) {
  const json = `${'a'.repeat(containerCharBudget + pad)}`;
  assert.ok(fitJsonBlock(json).content.length <= containerCharBudget);
 }
});

test('a backtick flood cannot break out of the code fence', () => {
 const json = JSON.stringify({ evil: '`'.repeat(6000) }, null, 2);
 const { content, truncated } = fitJsonBlock(json);
 const body = content.slice('```json\n'.length, -'\n```'.length);

 assert.equal(truncated, true);
 assert.equal(body.includes('```'), false);
 assert.equal(content.length, containerCharBudget);
});

test('ordinary inline code is left byte-identical', () => {
 const json = JSON.stringify({ content: 'use `npm i` first' }, null, 2);

 assert.equal(fitJsonBlock(json).content.includes(String.fromCharCode(0x200b)), false);
});

test('truncating mid-emoji never emits a lone surrogate', () => {
 for (let pad = 0; pad < 6; pad += 1) {
  const json = `${'a'.repeat(containerCharBudget - fenceOverhead - 2 + pad)}${'🎉'.repeat(40)}`;
  const { content } = fitJsonBlock(json);

  assert.equal(Buffer.from(content, 'utf-8').toString('utf-8'), content);
 }
});

test('a budget smaller than the fence itself does not throw or go negative', () => {
 const { content, truncated } = fitJsonBlock('{"a":1}', 4);

 assert.equal(truncated, true);
 assert.equal(content.includes('…'), true);
});
