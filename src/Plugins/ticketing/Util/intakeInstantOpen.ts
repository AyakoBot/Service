import { RequestHandlerError } from '@ayako/api';
import { TicketType } from '@ayako/database';

import type { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type TicketPlugin from '../Plugin.js';

import { buildEndPayload, buildExistingPayload } from './buildIntakePayload.js';
import getSharedTicketGuilds from './getSharedTicketGuilds.js';
import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';
import { getErrorMessage } from './handleTicketError.js';
import isUnderLimit from './isUnderLimit.js';
import { findDmBotSetting } from './resolveDmBotApi.js';

export default async function (
 this: TicketPlugin,
 userId: string,
 dmChannelId: string,
 recipientId?: string,
): Promise<boolean> {
 if (!recipientId) return false;

 const candidates = await getSharedTicketGuilds.call(this.client, userId);
 const match = findDmBotSetting(candidates, recipientId);
 if (!match?.setting.dmInstantOpen) return false;
 if (![TicketType.dmToChannel, TicketType.dmToThread].includes(match.setting.type)) return false;

 const api = await this.getAPI(match.guildId, match.setting.botToken);
 const sendToDm = async (payload: MessagePayload) => {
  const sent = await api.channels.createDirectMessage(dmChannelId, payload.getAPIPayload(), {
   origin: this.name,
   reason: 'Ticket instant-open response',
  });
  if (sent instanceof RequestHandlerError) this.nonFatalError(sent, 'intakeInstantOpen');
 };

 const limit = await isUnderLimit.call(this.client, match.setting, userId);
 if (!limit.ok) {
  await sendToDm(await buildExistingPayload.call(this, match.guildId, limit.ticketId));
  return true;
 }

 const member = await this.client.cache.members.get(match.guildId, userId);
 const user = await this.client.cache.users.get(userId);

 const ticket = getTicketClassBySettingsType.call(this.client, match.setting.type, '0');
 const create = ticket.create(
  { settingsId: String(match.setting.id), userId },
  { userId, roleIds: member?.roles ?? [], username: user?.username || userId },
 );

 try {
  await create.next();
 } catch (error) {
  const t = await this.t(match.guildId);
  await sendToDm(
   await buildEndPayload.call(this, getErrorMessage.call(this.client, t, error as Error)),
  );
 }

 return true;
}
