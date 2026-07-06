import type { TicketType } from '@ayako/database';
import type { APIMessageComponentInteraction } from 'discord-api-types/v10';

import type TicketPlugin from '../Plugin.js';

import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';
import handleTicketError from './handleTicketError.js';

export default function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 opts: {
  guildId: string;
  settingsId: string;
  type: TicketType;
  userId: string;
  roleIds: string[];
  username: string;
 },
) {
 const ticket = getTicketClassBySettingsType.call(this.client, opts.type, '0');
 const create = ticket.create(
  { settingsId: opts.settingsId, userId: opts.userId },
  { cmd, userId: opts.userId, roleIds: opts.roleIds, username: opts.username },
 );
 create
  .next()
  .catch((e: Error) =>
   handleTicketError.call(this.client, { guildId: opts.guildId, error: e, cmd }),
  );
}
