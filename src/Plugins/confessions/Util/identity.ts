import { createHmac } from 'node:crypto';

import { ConfessionAnonymity } from '@ayako/database';

export enum IdentityError {
 SecretMissing = 'confessions:secret-missing',
}

export const deriveIdentity = (
 guildId: string,
 userId: string,
 secret: string | undefined,
): string => {
 if (!secret) throw new Error(IdentityError.SecretMissing);

 return createHmac('sha256', `${secret}:${guildId}`).update(userId).digest('hex');
};

export const authorFor = (anonymity: ConfessionAnonymity, userId: string): string | null =>
 anonymity === ConfessionAnonymity.Unmaskable ? userId : null;

export const canReveal = (anonymity: ConfessionAnonymity): boolean =>
 anonymity === ConfessionAnonymity.Unmaskable;

export const isAuthorOf = (
 confession: { identity: string; author: string | null },
 identity: string,
 userId: string,
): boolean =>
 confession.identity === identity ||
 confession.identity === userId ||
 confession.author === userId;
