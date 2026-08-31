import { RequestHandlerError } from '@ayako/api';

import type TicketPlugin from '../Plugin.js';

import { buildGreetingPayload } from './buildIntakePayload.js';
import findStuckDmTickets from './findStuckDmTickets.js';
import getSharedTicketGuilds from './getSharedTicketGuilds.js';
import { resolveDmBotApi } from './resolveDmBotApi.js';

export default async function (
 this: TicketPlugin,
 userId: string,
 dmChannelId: string,
 firstMessage: string,
 attachmentUrls: string[],
 recipientId?: string,
) {
 const candidates = await getSharedTicketGuilds.call(this.client, userId);
 if (!candidates.length) return;

 const api = await resolveDmBotApi.call(this, candidates, recipientId);
 if (!api) return;

 const stuck = await findStuckDmTickets.call(this, userId, dmChannelId, api.botId);

 const payload = await buildGreetingPayload.call(
  this,
  firstMessage,
  attachmentUrls,
  stuck.length ? String(stuck[0].id) : undefined,
 );
 const sent = await api.channels.createDirectMessage(dmChannelId, payload.getAPIPayload(), {
  origin: this.name,
  reason: 'Sending ticket intake greeting',
 });

 if (sent instanceof RequestHandlerError) this.nonFatalError(sent, 'intakeGreet');
}
