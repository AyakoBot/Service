import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { type API as CustomAPI, RequestHandlerError } from '@ayako/api';
import type { APIApplicationEmoji, APIPartialEmoji } from 'discord-api-types/v10';

import type Client from './Client.js';
import { EmoteName } from './EmoteName.js';

const assetDir = path.join('assets', 'icons', 'pngs');

const buildEmoteSet = (resolve: (name: EmoteName) => APIPartialEmoji) => ({
 get: resolve,
 settings: resolve(EmoteName.Settings),
 trash: resolve(EmoteName.Trash),
 plus: resolve(EmoteName.Plus),
 edit: resolve(EmoteName.Edit),
 back: resolve(EmoteName.Back),
 forth: resolve(EmoteName.Forth),
 up: resolve(EmoteName.Up),
 prev: resolve(EmoteName.Prev),
 next: resolve(EmoteName.Next),
 warning: resolve(EmoteName.Warning),
 enabled: resolve(EmoteName.Enabled),
 disabled: resolve(EmoteName.Disabled),
 info: resolve(EmoteName.Info),
 question: resolve(EmoteName.Question),
 role: resolve(EmoteName.Role),
 member: resolve(EmoteName.Member),
 message: resolve(EmoteName.Message),
 emoji: resolve(EmoteName.Emoji),
 command: resolve(EmoteName.Command),
 automod: resolve(EmoteName.Automod),
 timer: resolve(EmoteName.Timer),
 number: resolve(EmoteName.Number),
 hammer: resolve(EmoteName.Hammer),
 shop: resolve(EmoteName.Shop),
 brain: resolve(EmoteName.Brain),
 calendar: resolve(EmoteName.Calendar),
 ticket: resolve(EmoteName.Ticket),
 log: resolve(EmoteName.Log),
 lock: resolve(EmoteName.Lock),
 unlock: resolve(EmoteName.Unlock),
 tools: resolve(EmoteName.Tools),
 heading: resolve(EmoteName.Heading),
 paragraph: resolve(EmoteName.Paragraph),
 author: resolve(EmoteName.Author),
 footer: resolve(EmoteName.Footer),
 image: resolve(EmoteName.Image),
 thumbnail: resolve(EmoteName.Thumbnail),
 palette: resolve(EmoteName.Palette),
 link: resolve(EmoteName.Link),
 fields: resolve(EmoteName.Fields),
 save: resolve(EmoteName.Save),
 send: resolve(EmoteName.Send),
 webhook: resolve(EmoteName.Webhook),
 json: resolve(EmoteName.Json),
 tick: resolve(EmoteName.Tick),
 cross: resolve(EmoteName.Cross),
 tickWithBackground: resolve(EmoteName.TickWithBackground),
 crossWithBackground: resolve(EmoteName.CrossWithBackground),
 refresh: resolve(EmoteName.Refresh),
 loading: resolve(EmoteName.Loading),
 gift: resolve(EmoteName.Gift),
 bot: resolve(EmoteName.Bot),
 invis: resolve(EmoteName.Invis),
 channelcategory: resolve(EmoteName.ChannelCategory),
 channelvoice: resolve(EmoteName.ChannelVoice),
 channelnews: resolve(EmoteName.ChannelNews),
 channelthread: resolve(EmoteName.ChannelThread),
 channelnewsthread: resolve(EmoteName.ChannelNewsThread),
 channelstage: resolve(EmoteName.ChannelStage),
 channelforum: resolve(EmoteName.ChannelForum),
 server: resolve(EmoteName.Server),
 invite: resolve(EmoteName.Invite),
 sticker: resolve(EmoteName.Sticker),
 badge: resolve(EmoteName.Badge),
 banner: resolve(EmoteName.Banner),
 avatar: resolve(EmoteName.Avatar),
 event: resolve(EmoteName.Event),
 soundboard: resolve(EmoteName.Soundboard),
 permissions: resolve(EmoteName.Permissions),
 crown: resolve(EmoteName.Crown),
 boost: resolve(EmoteName.Boost),
 globe: resolve(EmoteName.Globe),
 cpu: resolve(EmoteName.Cpu),
 shield: resolve(EmoteName.Shield),
 ban: resolve(EmoteName.Ban),
 banCross: resolve(EmoteName.BanCross),
 banError: resolve(EmoteName.BanError),
 banTick: resolve(EmoteName.BanTick),
 banUpdate: resolve(EmoteName.BanUpdate),
 mutedCross: resolve(EmoteName.MutedCross),
 mutedError: resolve(EmoteName.MutedError),
 mutedTick: resolve(EmoteName.MutedTick),
 mutedUpdated: resolve(EmoteName.MutedUpdated),
 timedoutCross: resolve(EmoteName.TimedoutCross),
 timedoutError: resolve(EmoteName.TimedoutError),
 timedoutTick: resolve(EmoteName.TimedoutTick),
 timedoutUpdated: resolve(EmoteName.TimedoutUpdated),
 channelTypes: {
  0: resolve(EmoteName.ChannelText),
  2: resolve(EmoteName.ChannelVoice),
  4: resolve(EmoteName.ChannelCategory),
  5: resolve(EmoteName.ChannelNews),
  10: resolve(EmoteName.ChannelNewsThread),
  11: resolve(EmoteName.ChannelThread),
  12: resolve(EmoteName.ChannelThread),
  13: resolve(EmoteName.ChannelStage),
  15: resolve(EmoteName.ChannelForum),
 },
 userFlags: {
  activeDeveloper: resolve(EmoteName.FlagActiveDeveloper),
  discordEmployee: resolve(EmoteName.FlagStaff),
  partneredServerOwner: resolve(EmoteName.FlagPartner),
  hypesquadEvents: resolve(EmoteName.FlagHypesquad),
  bugHunterLevel1: resolve(EmoteName.FlagBugHunter1),
  bugHunterLevel2: resolve(EmoteName.FlagBugHunter2),
  houseBravery: resolve(EmoteName.FlagBravery),
  houseBrilliance: resolve(EmoteName.FlagBrilliance),
  houseBalance: resolve(EmoteName.FlagBalance),
  earlySupporter: resolve(EmoteName.FlagEarlySupporter),
  verifiedBot: resolve(EmoteName.FlagVerifiedBot),
  earlyVerifiedBotDeveloper: resolve(EmoteName.FlagVerifiedDeveloper),
  discordCertifiedModerator: resolve(EmoteName.FlagCertifiedModerator),
  bot: resolve(EmoteName.FlagBot),
  nitro: resolve(EmoteName.FlagNitro),
  boost1: resolve(EmoteName.Boost1),
  boost2: resolve(EmoteName.Boost2),
  boost3: resolve(EmoteName.Boost3),
  boost6: resolve(EmoteName.Boost6),
  boost9: resolve(EmoteName.Boost9),
  boost12: resolve(EmoteName.Boost12),
  boost15: resolve(EmoteName.Boost15),
  boost18: resolve(EmoteName.Boost18),
  boost24: resolve(EmoteName.Boost24),
 },
});

export type EmoteSet = ReturnType<typeof buildEmoteSet>;

export default class EmojiRegistry {
 private client: Client;
 private byApp: Map<string, Map<string, APIApplicationEmoji>> = new Map();
 private sets: Map<string, EmoteSet> = new Map();
 private pending: Map<string, Promise<void>> = new Map();
 private warned: Set<string> = new Set();
 private invalidApps: Set<string> = new Set();
 private assets: Map<string, string> | null = null;

 constructor(client: Client) {
  this.client = client;
 }

 init = async () => {
  const apis = new Map<string, CustomAPI>();
  const base = this.client.getBaseAPI('emoji-registry');
  apis.set(base.botId, base);

  this.client.plugins.forEach((plugin) => {
   const token = plugin.getPluginBotToken();
   if (!token) return;

   const api = this.client.getTokenAPI(token, 'emoji-registry');
   if (!apis.has(api.botId)) apis.set(api.botId, api);
  });

  await Promise.all([...apis.values()].map((api) => this.ensure(api)));
  void this.syncStoredIdentities();
 };

 ensure = (api: CustomAPI): Promise<void> => {
  if (this.byApp.has(api.botId)) return Promise.resolve();

  const pending = this.pending.get(api.botId);
  if (pending) return pending;

  const promise = this.sync(api).finally(() => this.pending.delete(api.botId));
  this.pending.set(api.botId, promise);
  return promise;
 };

 ensureToken = (token: string): Promise<void> =>
  this.ensure(this.client.getTokenAPI(token, 'emoji-registry'));

 for = (api: CustomAPI): EmoteSet => {
  if (!this.byApp.has(api.botId)) void this.ensure(api);

  const cached = this.sets.get(api.botId);
  if (cached) return cached;

  const set = buildEmoteSet((name) => this.resolve(api.botId, name));
  this.sets.set(api.botId, set);
  return set;
 };

 private syncStoredIdentities = async () => {
  await Promise.all(
   this.client.plugins.map(async (plugin) => {
    if (!plugin.getEmojiSyncTokens) return;

    const tokens = await plugin.getEmojiSyncTokens().catch((error: Error) => {
     this.client.logger.error(
      `[EmojiRegistry] Failed to collect identity tokens: ${error.message}`,
     );
     return [] as string[];
    });

    await Promise.all(
     tokens.map(async (token) => {
      const api = this.client.getTokenAPI(token, 'emoji-registry');
      await this.ensure(api);
      if (!this.invalidApps.has(api.botId)) return;

      this.client.logger.warn(
       `[EmojiRegistry] Pruning invalid stored token for app ${api.botId}`,
      );
      await plugin
       .onEmojiSyncTokenInvalid?.(token)
       .catch((error: Error) =>
        this.client.logger.error(
         `[EmojiRegistry] Failed to prune token for app ${api.botId}: ${error.message}`,
        ),
       );
     }),
    );
   }),
  );
 };

 private resolve = (appId: string, name: EmoteName): APIPartialEmoji => {
  const emoji = this.byApp.get(appId)?.get(name);
  if (emoji?.id) return { id: emoji.id, name: emoji.name, animated: emoji.animated ?? false };

  if (!this.pending.has(appId)) this.warnOnce(appId, name);
  return { id: null, name };
 };

 private warnOnce = (appId: string, name: string) => {
  const key = `${appId}:${name}`;
  if (this.warned.has(key)) return;

  this.warned.add(key);
  this.client.logger.warn(`[EmojiRegistry] No emoji "${name}" for app ${appId}`);
 };

 private sync = async (api: CustomAPI) => {
  const existing = await api.applications.getEmojis({
   origin: 'emojiRegistry',
   reason: 'startup emoji sync',
  });
  if (existing instanceof RequestHandlerError) {
   const status = (existing.error as { status?: number } | null)?.status;
   if (status === 401) this.invalidApps.add(api.botId);

   this.client.logger.error(
    `[EmojiRegistry] Failed to fetch emojis for app ${api.botId} (status: ${status ?? 'unknown'})`,
   );
   return;
  }

  const byName = new Map(
   existing.items.filter((emoji) => emoji.name).map((emoji) => [emoji.name as string, emoji]),
  );
  const assets = await this.readAssets();

  for (const [name, image] of assets) {
   if (byName.has(name)) continue;

   const created = await api.applications.createEmoji(
    { name, image },
    { origin: 'emojiRegistry', reason: 'startup emoji sync' },
   );
   if (created instanceof RequestHandlerError) {
    this.client.logger.error(
     `[EmojiRegistry] Failed to create emoji "${name}" for app ${api.botId}`,
    );
    continue;
   }

   byName.set(name, created);
  }

  this.byApp.set(api.botId, byName);
 };

 private readAssets = async () => {
  if (this.assets) return this.assets;

  const files = await readdir(assetDir);
  const entries = await Promise.all(
   files
    .filter((file) => file.endsWith('.png'))
    .map(async (file): Promise<[string, string]> => [
     file.replace(/\.png$/, '').replaceAll('-', '_'),
     `data:image/png;base64,${(await readFile(path.join(assetDir, file))).toString('base64')}`,
    ]),
  );

  this.assets = new Map(entries);
  return this.assets;
 };
}
