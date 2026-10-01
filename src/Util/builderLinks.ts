import { gunzipSync } from 'node:zlib';

import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10';

export enum BuilderSite {
 DiscordBuilders = 'discordBuilders',
 Discohook = 'discohook',
 MessageStyle = 'messageStyle',
}

export const builderSiteUrls: Record<BuilderSite, string> = {
 [BuilderSite.DiscordBuilders]: 'https://discord.builders/',
 [BuilderSite.Discohook]: 'https://discohook.app',
 [BuilderSite.MessageStyle]: 'https://message.style/app/editor/new',
};

export const builderSiteNames: Record<BuilderSite, string> = {
 [BuilderSite.DiscordBuilders]: 'discord.builders',
 [BuilderSite.Discohook]: 'Discohook',
 [BuilderSite.MessageStyle]: 'message.style',
};

const siteHosts = new Map<string, BuilderSite>([
 ['discord.builders', BuilderSite.DiscordBuilders],
 ['www.discord.builders', BuilderSite.DiscordBuilders],
 ['discohook.app', BuilderSite.Discohook],
 ['www.discohook.app', BuilderSite.Discohook],
 ['discohook.org', BuilderSite.Discohook],
 ['www.discohook.org', BuilderSite.Discohook],
 ['message.style', BuilderSite.MessageStyle],
 ['www.message.style', BuilderSite.MessageStyle],
]);

const discohookShareApi = 'https://discohook.app/api/v1/share/';
const messageStyleShareApi = 'https://message.style/api/shared-messages/';
const messageStyleSharePath = /^\/app\/editor\/share\/([^/]+)\/?$/;
const discordBuildersParam = 'v1=';
const discordBuildersVersion = '1';
const fetchTimeoutMs = 2500;
const maxDesignBytes = 1024 * 1024;

interface DiscohookBackup {
 messages?: { data?: unknown }[];
}

const fetchJson = async (url: string): Promise<unknown> => {
 const res = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) }).catch(() => null);
 if (!res?.ok) return null;
 return res.json().catch(() => null);
};

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

const discohook = async (url: URL): Promise<unknown> => {
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

 const body = (await fetchJson(`${discohookShareApi}${encodeURIComponent(share)}`)) as {
  data?: unknown;
 } | null;
 return firstMessageData(body?.data);
};

const discordBuildersPayload = (url: URL): string | null => {
 const raw = url.search
  .slice(1)
  .split('&')
  .find((part) => part.startsWith(discordBuildersParam));
 if (!raw) return null;

 let value: string;
 try {
  value = decodeURIComponent(raw.slice(discordBuildersParam.length));
 } catch {
  return null;
 }

 const separator = value.indexOf('$');
 if (separator < 0 || value.slice(0, separator) !== discordBuildersVersion) return null;
 return value.slice(separator + 1);
};

const discordBuilders = async (url: URL): Promise<unknown> => {
 const payload = discordBuildersPayload(url);
 if (!payload) return null;

 try {
  const json = gunzipSync(Buffer.from(payload, 'base64'), { maxOutputLength: maxDesignBytes });
  const components: unknown = JSON.parse(json.toString('utf8'));
  return Array.isArray(components) ? { flags: MessageFlags.IsComponentsV2, components } : null;
 } catch {
  return null;
 }
};

const messageStyle = async (url: URL): Promise<unknown> => {
 const id = messageStyleSharePath.exec(url.pathname)?.[1];
 if (!id) return null;

 const body = (await fetchJson(`${messageStyleShareApi}${encodeURIComponent(id)}`)) as {
  data?: { data?: unknown };
 } | null;
 return body?.data?.data ?? null;
};

const resolvers: Record<BuilderSite, (url: URL) => Promise<unknown>> = {
 [BuilderSite.DiscordBuilders]: discordBuilders,
 [BuilderSite.Discohook]: discohook,
 [BuilderSite.MessageStyle]: messageStyle,
};

export const isLink = (input: string): boolean => /^https?:\/\//i.test(input);

export const resolveBuilderLink = async (input: string): Promise<unknown> => {
 let url: URL;
 try {
  url = new URL(input);
 } catch {
  return null;
 }

 const site = siteHosts.get(url.hostname);
 return site ? resolvers[site](url) : null;
};

export const builderSiteRow = (sites: BuilderSite[]) =>
 new ActionRowBuilder<ButtonBuilder>().addComponents(
  sites.map((site) =>
   new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(builderSiteUrls[site])
    .setLabel(builderSiteNames[site]),
  ),
 );
