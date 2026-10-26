import type { TicketType } from '@ayako/database';

import type { TicketInteraction } from '../Classes/ChannelTicket.js';
import type TicketPlugin from '../Plugin.js';

import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';
import handleTicketError from './handleTicketError.js';

export default function (
 this: TicketPlugin,
 cmd: TicketInteraction,
 opts: {
  guildId: string;
  settingsId: string;
  type: TicketType;
  userId: string;
  roleIds: string[];
  username: string;
  text?: string;
 },
) {
 const ticket = getTicketClassBySettingsType.call(this.client, opts.type, '0');
 const create = ticket.create(
  { settingsId: opts.settingsId, userId: opts.userId },
  { cmd, userId: opts.userId, roleIds: opts.roleIds, username: opts.username, text: opts.text },
 );
 create
  .next()
  .catch((e: Error) =>
   handleTicketError.call(this.client, { guildId: opts.guildId, error: e, cmd }),
  );
}
