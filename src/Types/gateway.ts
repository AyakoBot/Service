import type { GatewayDispatchEvents, GatewayDispatchPayload } from '@discordjs/core';

export type ExtractPayload<E extends GatewayDispatchEvents> = Extract<
 GatewayDispatchPayload,
 { t: E }
> extends { d: infer D }
 ? D
 : never;

export type GatewayEventPayloadMap = {
 [E in GatewayDispatchEvents]: ExtractPayload<E>;
};

export type GatewayEventHandler<E extends GatewayDispatchEvents> = (
 data: GatewayEventPayloadMap[E],
) => void | Promise<void>;

export type GatewayEventHandlers<E extends GatewayDispatchEvents = GatewayDispatchEvents> = {
 [K in E]: GatewayEventHandler<K>;
};
