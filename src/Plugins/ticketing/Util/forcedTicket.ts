import type { TicketSetting } from '@ayako/database';

import type { TicketCommandInteraction } from '../Classes/ChannelTicket.js';
import type DmToChannelTicket from '../Classes/DmToChannelTicket.js';
import type TicketPlugin from '../Plugin.js';

import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';

export interface ForcedTicketArgs {
 settings: TicketSetting;
 targetId: string;
 staffId: string;
 roleIds: string[];
 username: string;
 cmd?: TicketCommandInteraction;
}

export const forcedTicket = function (this: TicketPlugin, args: ForcedTicketArgs) {
 const ticket = getTicketClassBySettingsType.call(
  this.client,
  args.settings.type,
  '0',
 ) as DmToChannelTicket;

 const create = ticket.create(
  { settingsId: String(args.settings.id), userId: args.targetId, opener: args.staffId },
  { cmd: args.cmd, userId: args.targetId, roleIds: args.roleIds, username: args.username },
 );

 return { ticket, create };
};
