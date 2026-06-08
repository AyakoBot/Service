import ms, { type StringValue } from 'ms';

export default (duration: string, max?: number): number | null => {
 const trimmed = duration.trim();
 if (!trimmed) return 0;
 if (Number(trimmed) === 0) return 0;

 const args = trimmed.split(/\s+/g);
 const mergedDurationArgs: string[] = [];

 for (let i = 0; i < args.length; i += 1) {
  if (Number(args[i]) === ms(args[i] as StringValue)) {
   mergedDurationArgs.push(`${args[i]} ${args[i + 1]}`);
   i += 1;
   continue;
  }

  mergedDurationArgs.push(args[i]);
 }

 let total = 0;
 for (const arg of mergedDurationArgs) {
  const value = ms(arg as StringValue);
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  total += value;
 }

 const result = Math.abs(total);
 if (max !== undefined && result > max) return max;
 return result;
};
