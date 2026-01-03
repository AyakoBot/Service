import type { GatewayDispatchEvents, GatewayDispatchPayload } from '@discordjs/core';

/**
 * Helper type that extracts the payload from a GatewayDispatchPayload union
 * by matching the event type `t` field.
 */
export type ExtractPayload<E extends GatewayDispatchEvents> = Extract<
 GatewayDispatchPayload,
 { t: E }
> extends { d: infer D }
 ? D
 : never;

/**
 * Maps each GatewayDispatchEvents to its corresponding payload type.
 * This enables type-safe event handling where the handler receives
 * the correct payload type for each event.
 */
export type GatewayEventPayloadMap = {
 [E in GatewayDispatchEvents]: ExtractPayload<E>;
};

/**
 * Type-safe event handler signature for a specific gateway event.
 */
export type GatewayEventHandler<E extends GatewayDispatchEvents> = (
 data: GatewayEventPayloadMap[E],
) => void | Promise<void>;

/**
 * Partial record of event handlers, allowing plugins to only implement
 * handlers for specific events they care about.
 */
export type GatewayEventHandlers<E extends GatewayDispatchEvents = GatewayDispatchEvents> = {
 [K in E]: GatewayEventHandler<K>;
};
