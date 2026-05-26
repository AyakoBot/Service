import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import type TicketPlugin from '../../Plugin.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<
  | GatewayDispatchEvents.MessageCreate
  | GatewayDispatchEvents.MessageUpdate
  | GatewayDispatchEvents.MessageDelete
 >,
) {}

// Cases
/**
 * dmToChannel
 * ✅ Channel to direct message
 * ✅ Direct message to channel
 * logThreadLog
 *
 * dmToThread
 * Thread to direct message
 * Direct message to thread
 * Thread private
 * Log
 *
 * Channel
 * Log to Channel
 * Log
 *
 * Thread
 * Log to Thread
 * Log
 */
