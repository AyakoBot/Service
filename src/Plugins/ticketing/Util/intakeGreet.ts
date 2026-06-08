import { RequestHandlerError } from '@ayako/api';

import type TicketPlugin from '../Plugin.js';

import { buildGreetingPayload } from './buildIntakePayload.js';
import getSharedTicketGuilds from './getSharedTicketGuilds.js';

export default async function (
 this: TicketPlugin,
 userId: string,
 dmChannelId: string,
 firstMessage: string,
) {
 const candidates = await getSharedTicketGuilds.call(this.client, userId);
 if (!candidates.length) return;

 const payload = await buildGreetingPayload.call(this, firstMessage);

 const api = this.client.getBaseAPI();
 const sent = await api.channels.createDirectMessage(dmChannelId, payload.getAPIPayload(), {
  origin: this.name,
  reason: 'Sending ticket intake greeting',
 });

 if (sent instanceof RequestHandlerError) this.nonFatalError(sent, 'intakeGreet');
}
