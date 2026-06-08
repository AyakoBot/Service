import { type AfkState } from '@ayako/database';
import { EmbedBuilder } from '@discordjs/builders';

import { Colors } from '../../../Types/index.js';
import type AFKPlugin from '../Plugin.js';

import { getCensoredContent } from './censorContent.js';

export const getContent = async function (
 this: AFKPlugin,
 guildId: string,
 afk: AfkState | null,
 userId: string,
) {
 const t = await this.t(guildId);

 if (!afk) return t.t.set({ user: await this.client.cache.users.get(userId) });
 return t.t.updated({ user: await this.client.cache.users.get(userId) });
};

export const buildReasonEmbeds = async function (
 this: AFKPlugin,
 guildId: string,
 reason: string | null | undefined,
 channelId: string,
 roleIds: string[],
): Promise<EmbedBuilder[]> {
 if (!reason) return [];

 const censored = await getCensoredContent.call(this, guildId, reason, channelId, roleIds);
 return [new EmbedBuilder().setColor(Colors.Loading).setDescription(`-# ${censored}`)];
};
