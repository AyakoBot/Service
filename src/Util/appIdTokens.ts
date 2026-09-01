const baseKeys = ['Token', 'DevToken'];

const appIdOf = (token: string): string | null => {
 const [segment] = token.replace('Bot ', '').split('.');
 if (!segment) return null;

 try {
  const decoded = Buffer.from(segment, 'base64').toString('utf8');
  return /^\d{15,}$/.test(decoded) ? decoded : null;
 } catch {
  return null;
 }
};

export const buildAppIdTokenMap = (env: NodeJS.ProcessEnv = process.env): Map<string, string> => {
 const map = new Map<string, string>();

 Object.entries(env).forEach(([key, value]) => {
  if (!value) return;
  if (!key.endsWith('_TOKEN') && !baseKeys.includes(key)) return;

  const appId = appIdOf(value);
  if (appId) map.set(appId, value.replace('Bot ', ''));
 });

 return map;
};
