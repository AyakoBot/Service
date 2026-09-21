import type { GatewayDispatchEvents } from 'discord-api-types/v10';
import {
 ApplicationCommandType,
 InteractionType,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { EconomyCommand } from '../../Classes/Commands.js';
import { EconomyRoute } from '../../Classes/Routes.js';
import type EconomyPlugin from '../../Plugin.js';
import { deferEconomy } from '../../Util/respond.js';

import admin, { leaderboard } from './admin.js';
import balance from './balance.js';
import curvePreview from './curvePreview.js';
import shopBuy from './shopBuy.js';
import pay from './pay.js';
import shop from './shop.js';

type Handler = (
 this: EconomyPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
) => Promise<unknown>;

type ComponentHandler = (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 rowId: string,
) => Promise<unknown>;

const routes: Partial<Record<EconomyCommand, Handler>> = {
 [EconomyCommand.Balance]: balance,
 [EconomyCommand.Baltop]: leaderboard,
 [EconomyCommand.Pay]: pay,
 [EconomyCommand.Shop]: shop,
 [EconomyCommand.Economy]: admin,
};

const components: Partial<Record<EconomyRoute, ComponentHandler>> = {
 [EconomyRoute.CurvePreview]: curvePreview,
 [EconomyRoute.ShopBuy]: shopBuy,
};

export default async function (
 this: EconomyPlugin,
 data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (data.type === InteractionType.MessageComponent) {
  const [route, ...args] = data.data.custom_id.split('_');
  const component = components[route as EconomyRoute];
  const rowId = args[0] ?? '';
  const userId = data.member?.user.id ?? data.user?.id;
  if (!component || !data.guild_id || !userId || !rowId) return;

  await deferEconomy.call(this, data);
  await component.call(this, data, rowId);

  return;
 }

 if (data.type !== InteractionType.ApplicationCommand) return;
 if (data.data.type !== ApplicationCommandType.ChatInput) return;
 if (!data.guild_id) return;

 const handler = routes[data.data.name as EconomyCommand];
 if (!handler) return;

 await deferEconomy.call(this, data);
 await handler.call(this, data as APIChatInputApplicationCommandInteraction);
}
