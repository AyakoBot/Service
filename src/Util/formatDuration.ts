const units: [number, string][] = [
 [604800000, 'w'],
 [86400000, 'd'],
 [3600000, 'h'],
 [60000, 'm'],
 [1000, 's'],
];

export default (milliseconds: number): string => {
 let remaining = Math.max(0, Math.floor(milliseconds));
 const parts: string[] = [];

 for (const [size, suffix] of units) {
  const count = Math.floor(remaining / size);
  if (count > 0) {
   parts.push(`${count}${suffix}`);
   remaining -= count * size;
  }
 }

 return parts.join(' ');
};
