const hosts = ['discohook.app', 'www.discohook.app', 'discohook.org', 'www.discohook.org'];
const shareApi = 'https://discohook.app/api/v1/share/';

interface DiscohookBackup {
 messages?: { data?: unknown }[];
}

const decodeData = (data: string): unknown =>
 JSON.parse(
  Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
 );

const firstMessageData = (backup: unknown): unknown => {
 if (!backup || typeof backup !== 'object') return null;
 const { messages } = backup as DiscohookBackup;
 if (!Array.isArray(messages) || !messages.length) return null;
 return messages[0]?.data ?? null;
};

export const isLink = (input: string): boolean => /^https?:\/\//i.test(input);

export const resolveDiscohookLink = async (input: string): Promise<unknown> => {
 let url: URL;
 try {
  url = new URL(input);
 } catch {
  return null;
 }
 if (!hosts.includes(url.hostname)) return null;

 const data = url.searchParams.get('data');
 if (data) {
  try {
   return firstMessageData(decodeData(data));
  } catch {
   return null;
  }
 }

 const share = url.searchParams.get('share');
 if (!share) return null;

 const res = await fetch(`${shareApi}${encodeURIComponent(share)}`).catch(() => null);
 if (!res?.ok) return null;

 const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
 return firstMessageData(body?.data);
};
