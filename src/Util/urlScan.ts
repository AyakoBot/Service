import dns from 'node:dns/promises';
import net from 'node:net';

import { logger } from '@ayako/utility';

import fallbackTlds from './tldFallback.js';

export const maxRedirects = 5;
export const fetchTimeout = 5000;
export const maxScanLength = 4096;
export const tldRefreshInterval = 86_400_000;
export const tldSourceURL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';

export type RedirectHop = { url: string; status: number };

const isPrivateIPv4 = (ip: string): boolean => {
 const parts = ip.split('.').map((part) => Number(part));
 if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;

 const [a, b] = parts;
 if (a === 0) return true;
 if (a === 10) return true;
 if (a === 100 && b >= 64 && b <= 127) return true;
 if (a === 127) return true;
 if (a === 169 && b === 254) return true;
 if (a === 172 && b >= 16 && b <= 31) return true;
 if (a === 192 && b === 168) return true;
 if (a >= 224) return true;
 return false;
};

const expandIPv6 = (ip: string): number[] | null => {
 const [addr] = ip.toLowerCase().split('%');
 const halves = addr.split('::');
 if (halves.length > 2) return null;

 const toGroups = (segment: string): number[] | null => {
  if (!segment) return [];
  const groups: number[] = [];

  for (const token of segment.split(':')) {
   if (token.includes('.')) {
    const octets = token.split('.').map((octet) => Number(octet));
    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
     return null;
    }
    groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
    continue;
   }

   if (token === '') return null;
   const value = Number.parseInt(token, 16);
   if (Number.isNaN(value) || value > 0xffff) return null;
   groups.push(value);
  }

  return groups;
 };

 const head = toGroups(halves[0]);
 const tail = halves.length === 2 ? toGroups(halves[1]) : [];
 if (!head || !tail) return null;

 if (halves.length === 2) {
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...new Array<number>(fill).fill(0), ...tail];
 }

 return head.length === 8 ? head : null;
};

const isPrivateIPv6 = (ip: string): boolean => {
 const groups = expandIPv6(ip);
 if (!groups) return false;

 const mappedPrefix = groups
  .slice(0, 6)
  .every((group, index) => group === (index === 5 ? 0xffff : 0));
 if (mappedPrefix) {
  const octets = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
  return isPrivateIPv4(octets.join('.'));
 }

 if (groups.every((group, index) => group === (index === 7 ? 1 : 0))) return true;

 const [first] = groups;
 if ((first & 0xfe00) === 0xfc00) return true;
 if ((first & 0xffc0) === 0xfe80) return true;

 return false;
};

export const isPrivateAddress = (ip: string): boolean => {
 const version = net.isIP(ip);
 if (version === 4) return isPrivateIPv4(ip);
 if (version === 6) return isPrivateIPv6(ip);
 return false;
};

const isPublicHost = async (hostname: string): Promise<boolean> => {
 if (net.isIP(hostname)) return !isPrivateAddress(hostname);

 try {
  const addresses = await dns.lookup(hostname, { all: true });
  return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
 } catch {
  return false;
 }
};

const fetchOnce = async (url: string): Promise<Response | null> => {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), fetchTimeout);

 try {
  return await fetch(url, { redirect: 'manual', signal: controller.signal });
 } catch {
  return null;
 } finally {
  clearTimeout(timer);
 }
};

export const fetchWithRedirects = async (url: string): Promise<RedirectHop[]> => {
 const chain: RedirectHop[] = [];
 const visited = new Set<string>();
 let current = url;

 for (let hop = 0; hop < maxRedirects; hop += 1) {
  if (visited.has(current)) break;
  visited.add(current);

  let parsed: URL;
  try {
   parsed = new URL(current);
  } catch {
   break;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') break;
  if (!(await isPublicHost(parsed.hostname.replace(/^\[|\]$/g, '')))) break;

  const response = await fetchOnce(current);
  if (!response) break;

  chain.push({ url: current, status: response.status });

  const location = response.headers.get('location');
  void response.body?.cancel().catch(() => undefined);
  if (!location || response.status < 300 || response.status >= 400) break;

  try {
   current = new URL(location, current).toString();
  } catch {
   break;
  }
 }

 return chain;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compileTldRegex = (tldSet: Set<string>): RegExp => {
 const alternation = [...tldSet]
  .map((tld) => tld.toLowerCase())
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|');

 return new RegExp(
  `\\b(?:https?:\\/\\/)?(?:[a-z0-9-]+\\.)+(?:${alternation})\\b(?:[/?#][^\\s]*)?`,
  'gi',
 );
};

let matcherCache: { set: Set<string>; regex: RegExp } | null = null;

export const getTldMatcher = (tldSet: Set<string>): RegExp => {
 if (!matcherCache || matcherCache.set !== tldSet) {
  matcherCache = { set: tldSet, regex: compileTldRegex(tldSet) };
 }
 return matcherCache.regex;
};

export const extractUrls = (content: string, tldSet: Set<string>): string[] => {
 if (!tldSet.size) {
  logger.warn('[urlScan] TLD set empty — skipping URL extraction (fail closed)');
  return [];
 }

 const regex = getTldMatcher(tldSet);
 regex.lastIndex = 0;
 const matches = content.slice(0, maxScanLength).match(regex) ?? [];
 return [...new Set(matches.map((match) => match.trim()))];
};

export const parseTldList = (raw: string): Set<string> =>
 new Set(
  raw
   .split('\n')
   .map((line) => line.trim().toLowerCase())
   .filter((line) => line.length > 0 && !line.startsWith('#')),
 );

let currentTlds = new Set(fallbackTlds);

export const getTlds = (): Set<string> => currentTlds;

export const refreshTlds = async (): Promise<void> => {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), fetchTimeout);

 try {
  const response = await fetch(tldSourceURL, { signal: controller.signal });
  if (!response.ok) throw new Error(`status ${response.status}`);

  const parsed = parseTldList(await response.text());
  if (parsed.size) currentTlds = parsed;
 } catch (error) {
  logger.warn(
   `[urlScan] TLD refresh failed, keeping ${currentTlds.size} cached TLDs: ${String(error)}`,
  );
 } finally {
  clearTimeout(timer);
 }
};

export const startTldRefresh = (): NodeJS.Timeout => {
 void refreshTlds();
 return setInterval(() => void refreshTlds(), tldRefreshInterval);
};
