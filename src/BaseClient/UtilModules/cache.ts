import * as Jobs from 'node-schedule';

import inviteGuilds, { type InviteGuilds } from './cache/discord/inviteGuilds.js';

import bans, { type Bans } from './cache/bot/bans.js';
import channelBans, { type ChannelBans } from './cache/bot/channelBans.js';
import deleteSuggestions, { type DeleteSuggestions } from './cache/bot/deleteSuggestions.js';
import deleteThreads, { type DeleteThreads } from './cache/bot/deleteThreads.js';
import disboardBumpReminders, {
 type DisboardBumpReminders,
} from './cache/bot/disboardBumpReminders.js';
import gifs from './cache/bot/gifs.js';
import giveawayClaimTimeout, {
 type GiveawayClaimTimeout,
} from './cache/bot/giveawayClaimTimeout.js';
import giveaways, { type Giveaways } from './cache/bot/giveaways.js';
import mutes, { type Mutes } from './cache/bot/mutes.js';
import stickyTimeouts, { type StickyTimeouts } from './cache/bot/stickyTimeouts.js';
import unblockedModUsers, { type UnblockedModUsers } from './cache/bot/unblockedModUsers.js';
import vcDeafens, { type VcDeafens } from './cache/bot/vcDeafens.js';
import vcDeleteTimeout, { type VcDeleteTimeout } from './cache/bot/vcDeleteTimeout.js';
import vcMutes, { type VcMutes } from './cache/bot/vcMutes.js';
import votes, { type Votes } from './cache/bot/votes.js';

import fishFish, { type FishFish } from './cache/urls/fishFish.js';
import sinkingYachts, { type SinkingYachts } from './cache/urls/sinkingYachts.js';
import urlTLDs, { type UrlTLDs } from './cache/urls/urlTLDs.js';
import type { API, APIEmbed } from '@discordjs/core';

/**
 * Discord and Cache data stored in the client.
 */
const cache: {
 // Discord Cache
 inviteGuilds: InviteGuilds;
 voiceChannelStatus: Map<string, string>;

 // Cache
 giveawayClaimTimeout: GiveawayClaimTimeout;
 mutes: Mutes;
 vcMutes: VcMutes;
 vcDeafens: VcDeafens;
 bans: Bans;
 channelBans: ChannelBans;
 disboardBumpReminders: DisboardBumpReminders;
 votes: Votes;
 giveaways: Giveaways;
 stickyTimeouts: StickyTimeouts;
 deleteThreads: DeleteThreads;
 apis: Map<string, API>;
 punishments: Set<string>;
 antispam: Map<string, RMessage[]>;
 deleteSuggestions: DeleteSuggestions;
 vcDeleteTimeout: VcDeleteTimeout;
 interactedGuilds: Set<string>;
 interactedChannels: Set<string>;
 fastMsgCache: Map<string, { msgs: RMessage[]; job: Jobs.Job }>;
 interactionInstallmentRunningFor: Set<string>;
 unblockedModUsers: UnblockedModUsers;
 gifs: typeof gifs;
 hasFetchedAllMembers: Set<string>;
 customClients: Map<string, string>;

 // URLs
 urlTLDs: UrlTLDs;
 sinkingYachts: SinkingYachts;
 fishFish: FishFish;
 reportedURLs: Set<string>;

 globalLevellingCD: Set<string>;
 guildLevellingCD: Set<string>;
 levellingCD: Map<string, Set<string>>;
 lastMessageGlobal: Map<string, string>;
 lastMessageGuild: Map<string, string>;
 afkCD: Map<string, Set<string>>;
 cooldown: Map<string, Map<string, number>>;
 antiraid: Map<string, Set<RMember>>;
 antiraidQueued: Set<string>;
 enableInvites: Map<string, Jobs.Job>;
 separatorAssigner: Map<string, Jobs.Job[]>;

 // embed queue
 channelQueue: Map<
  string,
  {
   job: Jobs.Job;
   embeds: APIEmbed[];
   channel: RThread | RChannel;
  }
 >;
} = {
 // Discord Cache
 inviteGuilds,
 interactedGuilds: new Set(),
 interactedChannels: new Set(),
 customClients: new Map(),
 voiceChannelStatus: new Map(),

 // Cache
 giveawayClaimTimeout,
 mutes,
 vcMutes,
 vcDeafens,
 bans,
 channelBans,
 disboardBumpReminders,
 votes,
 giveaways,
 stickyTimeouts,
 deleteThreads,
 apis: new Map(),
 punishments: new Set(),
 antispam: new Map(),
 deleteSuggestions,
 vcDeleteTimeout,
 fastMsgCache: new Map(),
 interactionInstallmentRunningFor: new Set(),
 unblockedModUsers,
 gifs,
 hasFetchedAllMembers: new Set(),

 // URLs
 urlTLDs,
 sinkingYachts,
 fishFish,
 reportedURLs: new Set(),

 globalLevellingCD: new Set(),
 guildLevellingCD: new Set(),
 levellingCD: new Map(),
 lastMessageGlobal: new Map(),
 lastMessageGuild: new Map(),
 afkCD: new Map(),
 cooldown: new Map(),
 antiraid: new Map(),
 antiraidQueued: new Set(),
 enableInvites: new Map(),
 separatorAssigner: new Map(),

 channelQueue: new Map(),
};

export default cache;
