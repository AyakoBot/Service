const allowedHosts = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export const isDiscordCdnUrl = (url: string): boolean => {
 try {
  return allowedHosts.has(new URL(url).hostname);
 } catch {
  return false;
 }
};

export const fetchDiscordCdn = async (
 url: string,
): Promise<{ data: Buffer; contentType: string } | null> => {
 if (!isDiscordCdnUrl(url)) return null;

 const res = await fetch(url, { redirect: 'error' }).catch(() => null);
 if (!res?.ok) return null;

 return {
  data: Buffer.from(await res.arrayBuffer()),
  contentType: res.headers.get('content-type') ?? 'application/octet-stream',
 };
};

export const toDataUri = (contentType: string, data: Buffer): string =>
 `data:${contentType};base64,${data.toString('base64')}`;
