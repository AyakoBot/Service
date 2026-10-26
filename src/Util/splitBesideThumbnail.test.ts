import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitBesideThumbnail } from './splitBesideThumbnail.js';

const author = '**Someone**';
const words = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`).join(' ');

test('keeps short text beside the avatar', () => {
 assert.deepEqual(splitBesideThumbnail(author, 'Hello there'), ['Hello there', '']);
 assert.deepEqual(splitBesideThumbnail(author, ''), ['', '']);
});

test('splits long text at a space after about four lines', () => {
 const text = words(80);
 const [beside, below] = splitBesideThumbnail(author, text);

 assert.ok(beside.length <= 200);
 assert.ok(beside.length > 150);
 assert.equal(`${beside} ${below}`, text);
});

test('counts every line break as a line', () => {
 const [beside, below] = splitBesideThumbnail(author, 'a\nb\nc\nd\ne\nf');

 assert.equal(beside, 'a\nb\nc\nd');
 assert.equal(below, 'e\nf');
});

test('a two-line author leaves one line less for the text', () => {
 const [beside, below] = splitBesideThumbnail('> -# Internal note by\n> -# Someone', 'a\nb\nc\nd');

 assert.equal(beside, 'a\nb\nc');
 assert.equal(below, 'd');
});

test('custom emoji count by their visible width', () => {
 const emoji = Array.from({ length: 40 }, () => '<:ayako_heart:1234567890123456789>').join(' ');

 assert.deepEqual(splitBesideThumbnail(author, emoji), [emoji, '']);
});

test('closes bold at the cut and reopens it below', () => {
 const [beside, below] = splitBesideThumbnail(author, `**${words(80)}**`);

 assert.ok(beside.endsWith('**'));
 assert.ok(below.startsWith('**'));
});

test('never cuts inside a link', () => {
 const link = `[${words(5)}](https://example.com)`;
 const text = `${'x'.repeat(190)} ${link} tail`;
 const [beside, below] = splitBesideThumbnail(author, text);

 assert.ok(!beside.includes('['));
 assert.ok(below.startsWith(link));
});

test('moves an open code fence below as a whole', () => {
 const text = `intro\n\`\`\`\n${words(60)}\n\`\`\``;
 const [beside, below] = splitBesideThumbnail(author, text);

 assert.equal(beside, 'intro');
 assert.ok(below.startsWith('```'));
});

test('keeps a quote going below a mid-line cut', () => {
 const [beside, below] = splitBesideThumbnail(author, `> ${words(80)}`);

 assert.ok(beside.startsWith('> '));
 assert.ok(below.startsWith('> '));
});
