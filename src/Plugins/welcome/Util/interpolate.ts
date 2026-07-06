import stp from '../../../Util/stp.js';

const interpolate = <T>(value: T, vars: Record<string, string>): T => {
 if (typeof value === 'string') return stp(value, vars) as T;
 if (Array.isArray(value)) return value.map((v) => interpolate(v, vars)) as T;
 if (value && typeof value === 'object') {
  return Object.fromEntries(
   Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)]),
  ) as T;
 }
 return value;
};

export default interpolate;
