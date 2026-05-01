import type { Ticket, TicketSetting } from '@ayako/database';
import type { GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import type TicketPlugin from '../../Plugin.js';

import ChannelToDm from './ChannelToDm.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
 ticket: Ticket & { settings: TicketSetting },
) {
 const forwardable = await shouldForward.call(this, msg, ticket);
 if (!forwardable) return;

 ChannelToDm.call(this, msg, ticket);
}

const shouldForward = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (ticket.settings.logChannels.includes(msg.channel_id)) return false;

 const thread = await this.client.cache.threads.get(msg.channel_id);
 if (!thread) return false;
 if (!ticket.settings.logChannels.includes(thread.parent_id || '')) return false;
 if (thread.name !== `log-${ticket.id}`) return false;
 return true;
};
