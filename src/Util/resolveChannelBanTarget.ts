/* eslint-disable @typescript-eslint/naming-convention */
import { AntiModPunishmentType } from '@ayako/database';
import { ChannelType } from 'discord-api-types/v10';

import type Plugin from '../Classes/abstracts/Plugin.js';

export const channelContextActions: AntiModPunishmentType[] = [
 AntiModPunishmentType.channelban,
 AntiModPunishmentType.tempchannelban,
 AntiModPunishmentType.strike,
];

const threadTypes: ChannelType[] = [
 ChannelType.AnnouncementThread,
 ChannelType.PublicThread,
 ChannelType.PrivateThread,
];

export const isThreadType = (type: number | null | undefined): boolean =>
 type !== null && type !== undefined && threadTypes.includes(type);

export const channelBanTarget = (
 channel: { type?: number | null; parent_id?: string | null } | null | undefined,
 channelId: string,
): string =>
 (channel && isThreadType(channel.type) && channel.parent_id ? channel.parent_id : channelId);

export default async function (
 this: Pick<Plugin, 'client' | 'getAPI'>,
 guildId: string,
 channelId: string,
): Promise<string> {
 const thread = await this.client.cache.threads.get(channelId);
 if (thread?.parent_id) return thread.parent_id;

 const api = await this.getAPI(guildId);
 const fetched = await api.channels.get(channelId).catch(() => null);
 return channelBanTarget(fetched, channelId);
}
