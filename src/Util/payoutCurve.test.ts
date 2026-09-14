import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PayoutCurve } from '@ayako/database';

import { payoutFor } from './payoutCurve.js';

const curves = Object.values(PayoutCurve);

describe('payoutFor', () => {
 it('pays exactly the base on the first payout, whatever the curve', () => {
  curves.forEach((curve) => {
   assert.equal(payoutFor(50, curve, 100, 1), 50, `${curve} should start at the base`);
  });
 });

 it('never decreases as the payout count rises', () => {
  curves.forEach((curve) => {
   const amounts = [1, 2, 3, 5, 10, 25].map((step) => payoutFor(50, curve, 100, step));

   amounts.forEach((amount, index) => {
    if (!index) return;
    assert.ok(amount >= amounts[index - 1]!, `${curve} dipped at step ${index}: ${amounts}`);
   });
  });
 });

 it('returns whole, non-negative numbers', () => {
  curves.forEach((curve) => {
   [1, 2, 7, 40].forEach((step) => {
    const amount = payoutFor(37, curve, 250, step);

    assert.ok(Number.isInteger(amount), `${curve} step ${step} was not an integer: ${amount}`);
    assert.ok(amount >= 0, `${curve} step ${step} was negative`);
   });
  });
 });

 it('pays nothing without a base or before the first payout', () => {
  assert.equal(payoutFor(0, PayoutCurve.cubic, 100, 3), 0);
  assert.equal(payoutFor(50, PayoutCurve.cubic, 100, 0), 0);
  assert.equal(payoutFor(-10, PayoutCurve.cubic, 100, 1), 0);
 });

 it('falls back to the base when the modifier is zero or negative', () => {
  assert.equal(payoutFor(50, PayoutCurve.linear, 0, 1), 50);
  assert.equal(payoutFor(50, PayoutCurve.linear, -5, 1), 50);
 });

 it('grows faster on cubic than on linear', () => {
  assert.ok(payoutFor(50, PayoutCurve.cubic, 100, 5) > payoutFor(50, PayoutCurve.linear, 100, 5));
 });
});
