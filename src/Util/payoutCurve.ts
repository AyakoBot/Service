import { PayoutCurve } from '@ayako/database';

const shapes: Record<PayoutCurve, (step: number, modifier: number) => number> = {
 [PayoutCurve.logarithmic]: (step, modifier) =>
  Math.log(step + 1) * Math.pow(step, 0.5) * modifier * 1000,
 [PayoutCurve.linear]: (step, modifier) => step * modifier * 100,
 [PayoutCurve.quadratic]: (step, modifier) => step * step * modifier,
 [PayoutCurve.cubic]: (step, modifier) => (step * step * step * modifier) / 100,
 [PayoutCurve.polynomial]: (step, modifier) =>
  (5 / 6) * step * (2 * step * step + 27 * step + 91) * Math.pow(modifier / 100, 0.5),
 [PayoutCurve.exponential]: (step, modifier) => Math.pow(1.5, step / 10) * modifier * 100,
};

export const curveShape = (curve: PayoutCurve, step: number, modifier: number): number =>
 shapes[curve](step, modifier);

export const payoutFor = (
 base: number,
 curve: PayoutCurve,
 modifier: number,
 step: number,
): number => {
 if (base <= 0 || step < 1) return 0;

 const safeModifier = modifier > 0 ? modifier : 100;
 const first = shapes[curve](1, safeModifier);
 if (!Number.isFinite(first) || first <= 0) return Math.round(base);

 const scaled = (base * shapes[curve](step, safeModifier)) / first;

 return Number.isFinite(scaled) ? Math.max(0, Math.round(scaled)) : Math.round(base);
};
