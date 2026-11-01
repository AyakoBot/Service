import { RequestHandlerError, type API } from '@ayako/api';

import type Client from '../Classes/Client.js';

import { countPlaceholders, MessagePlaceholder } from './messagePlaceholders.js';
import type { PlaceholderVars } from './placeholderVars.js';

interface CountSource {
 client: Client;
 name: string;
 getAPI: (guildId: string, overrideCipher?: string | null) => Promise<API>;
}

const allCounts = [MessagePlaceholder.Membercount, ...countPlaceholders];

export const usesPlaceholder = (json: unknown, placeholders: MessagePlaceholder[]) => {
 const text = json === undefined ? '' : JSON.stringify(json);
 return placeholders.some((placeholder) =>
  new RegExp(String.raw`{{\s?${placeholder}\s?}}`).test(text),
 );
};

export const countBots = async function (this: Client, guildId: string): Promise<number | null> {
 const { members, users } = this.cache;
 const fields = await members.redis.hkeys(members.keystore(guildId));
 const cached = await Promise.all(fields.map((field) => users.get(field.split(':').pop() ?? '')));
 return cached.filter((user) => user?.bot).length || null;
};

const totalMembers = async function (this: CountSource, guildId: string, cipher: string | null) {
 const api = await this.getAPI(guildId, cipher);
 const guild = await api.guilds.get(
  guildId,
  { with_counts: true },
  { origin: this.name, reason: 'member count placeholders' },
 );

 if (guild instanceof RequestHandlerError) return null;
 return guild.approximate_member_count ?? null;
};

export const memberCountVars = async function (
 this: CountSource,
 guildId: string,
 template: unknown,
 cipher: string | null = null,
): Promise<PlaceholderVars> {
 if (!usesPlaceholder(template, allCounts)) return {};

 const total = await totalMembers.call(this, guildId, cipher);
 const bots = usesPlaceholder(template, countPlaceholders)
  ? await countBots.call(this.client, guildId)
  : null;

 return {
  membercount: total === null ? '' : String(total),
  humancount: total === null || bots === null ? '' : String(Math.max(0, total - bots)),
  botcount: bots === null ? '' : String(bots),
 };
};
