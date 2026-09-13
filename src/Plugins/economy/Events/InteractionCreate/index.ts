import type { GatewayDispatchEvents } from 'discord-api-types/v10';
import {
 ApplicationCommandType,
 InteractionType,
 type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { EconomyCommand } from '../../Classes/Commands.js';
import type EconomyPlugin from '../../Plugin.js';

import admin, { leaderboard } from './admin.js';
import balance from './balance.js';
import pay from './pay.js';

type Handler = (
 this: EconomyPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
) => Promise<unknown>;

const routes: Partial<Record<EconomyCommand, Handler>> = {
 [EconomyCommand.Balance]: balance,
 [EconomyCommand.Baltop]: leaderboard,
 [EconomyCommand.Pay]: pay,
 [EconomyCommand.Economy]: admin,
};

export default async function (
 this: EconomyPlugin,
 data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (data.type !== InteractionType.ApplicationCommand) return;
 if (data.data.type !== ApplicationCommandType.ChatInput) return;
 if (!data.guild_id) return;

 await routes[data.data.name as EconomyCommand]?.call(
  this,
  data as APIChatInputApplicationCommandInteraction,
 );
}
