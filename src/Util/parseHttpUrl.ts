export default (value: string): string | null => {
 try {
  const url = new URL(value.trim());
  return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
 } catch {
  return null;
 }
};
