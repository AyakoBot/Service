import type { GiveawaySetting } from '@ayako/database';

export interface TrackingRules {
 messageChannels: string[];
 voiceChannels: string[];
 countMuted: boolean;
 countDeafened: boolean;
 minMembers: number;
}

/* eslint-disable @typescript-eslint/naming-convention */
export interface VoiceFlags {
 mute?: boolean;
 self_mute?: boolean;
 deaf?: boolean;
 self_deaf?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

export type RuleColumns = Pick<
 GiveawaySetting,
 'messageChannels' | 'voiceChannels' | 'voiceCountMuted' | 'voiceCountDeafened' | 'voiceMinMembers'
>;

export const rulesFrom = (row: RuleColumns): TrackingRules => ({
 messageChannels: row.messageChannels,
 voiceChannels: row.voiceChannels,
 countMuted: row.voiceCountMuted,
 countDeafened: row.voiceCountDeafened,
 minMembers: Math.max(1, Math.round(Number(row.voiceMinMembers) || 1)),
});

export const inScope = (allowed: string[], chain: (string | null | undefined)[]) =>
 !allowed.length || chain.some((id) => !!id && allowed.includes(id));

export const voiceCounts = (
 voice: VoiceFlags,
 rules: Pick<TrackingRules, 'countMuted' | 'countDeafened'>,
) => {
 if (voice.deaf || voice.self_deaf) return rules.countDeafened;
 if (voice.mute || voice.self_mute) return rules.countMuted;
 return true;
};
