import { TicketType, type TicketSetting } from '@ayako/database';

import type TicketPlugin from '../Plugin.js';

import isSettingsStaff from './isSettingsStaff.js';
import { safeBotId } from './resolveDmBotApi.js';

export enum ForceOpenBlock {
 NotActive = 'notActive',
 NotDmType = 'notDmType',
 NoCustomBot = 'noCustomBot',
 BotUnavailable = 'botUnavailable',
 NotStaff = 'notStaff',
}

export interface ForceOpenCandidate {
 settings: TicketSetting;
 block: ForceOpenBlock | null;
}

const dmTypes = [TicketType.dmToChannel, TicketType.dmToThread];

const blockOf = async function (
 this: TicketPlugin,
 guildId: string,
 settings: TicketSetting,
 staffId: string,
 staffRoleIds: string[],
): Promise<ForceOpenBlock | null> {
 if (!settings.active) return ForceOpenBlock.NotActive;
 if (!dmTypes.includes(settings.type)) return ForceOpenBlock.NotDmType;
 if (!settings.botToken) return ForceOpenBlock.NoCustomBot;
 if (!isSettingsStaff(settings, staffId, staffRoleIds)) return ForceOpenBlock.NotStaff;

 const expected = safeBotId(settings.botToken);
 if (!expected) return ForceOpenBlock.BotUnavailable;

 const api = await this.getAPI(guildId, settings.botToken);
 if (api.botId !== expected) return ForceOpenBlock.BotUnavailable;

 return null;
};

export default async function (
 this: TicketPlugin,
 guildId: string,
 staffId: string,
 staffRoleIds: string[],
): Promise<ForceOpenCandidate[]> {
 const settings = await this.client.db.client.ticketSetting.findMany({ where: { guild: guildId } });

 return Promise.all(
  settings.map(async (setting) => ({
   settings: setting,
   block: await blockOf.call(this, guildId, setting, staffId, staffRoleIds),
  })),
 );
}
