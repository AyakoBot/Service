import type AFKPlugin from '../Plugin.js';

const defaultMaxLetters = 250;

export const clampReason = async function (
 this: AFKPlugin,
 guildId: string,
 reason: string | null | undefined,
) {
 if (!reason) return reason;

 const setting = await this.client.db.client.afkSetting.findUnique({ where: { guildId } });
 return reason.slice(0, setting?.maxLetters ?? defaultMaxLetters);
};
