import { AntiModPunishmentType, type PunishmentOrigin } from '@ayako/database';

import type Plugin from '../Classes/abstracts/Plugin.js';
import { maxDeleteMessageSeconds } from '../Plugins/moderation/Classes/Actions/banAdd.js';
import { maxTimeoutMs } from '../Plugins/moderation/Classes/Actions/tempMuteAdd.js';
import type ModerationExecutor from '../Plugins/moderation/Classes/ModerationExecutor.js';
import type { ModBaseOptions, ModResult } from '../Plugins/moderation/Classes/ModOptions.js';
import ModerationPlugin from '../Plugins/moderation/Plugin.js';
import { ModCallerContext, ModTypes } from '../Types/moderation.js';

export interface DispatchContext {
 guildId: string;
 targetId: string;
 channelId?: string;
 action: AntiModPunishmentType;
 durationMs: number;
 deleteMessageSeconds: number;
 reason: string;
}

interface DispatchArgs {
 executor: ModerationExecutor;
 base: ModBaseOptions;
 ctx: DispatchContext;
 deleteMessageSeconds: number;
}

const noChannel: ModResult = { success: false, errorKey: 'noChannel' };

const dispatchTable: Record<AntiModPunishmentType, (args: DispatchArgs) => Promise<ModResult>> = {
 [AntiModPunishmentType.warn]: ({ executor, base }) => executor.run(ModTypes.WarnAdd, base),
 [AntiModPunishmentType.kick]: ({ executor, base }) => executor.run(ModTypes.KickAdd, base),
 [AntiModPunishmentType.strike]: ({ executor, base, ctx }) =>
  executor.run(ModTypes.StrikeAdd, { ...base, channelId: ctx.channelId }),
 [AntiModPunishmentType.softban]: ({ executor, base, deleteMessageSeconds }) =>
  executor.run(ModTypes.SoftBanAdd, { ...base, deleteMessageSeconds }),
 [AntiModPunishmentType.ban]: ({ executor, base, deleteMessageSeconds }) =>
  executor.run(ModTypes.BanAdd, { ...base, deleteMessageSeconds }),
 [AntiModPunishmentType.tempban]: ({ executor, base, ctx, deleteMessageSeconds }) =>
  executor.run(ModTypes.TempBanAdd, {
   ...base,
   durationMs: ctx.durationMs,
   deleteMessageSeconds,
  }),
 [AntiModPunishmentType.tempmute]: ({ executor, base, ctx }) =>
  executor.run(ModTypes.TempMuteAdd, {
   ...base,
   durationMs: Math.min(maxTimeoutMs, ctx.durationMs),
  }),
 [AntiModPunishmentType.channelban]: ({ executor, base, ctx }) =>
  (ctx.channelId
   ? executor.run(ModTypes.ChannelBanAdd, { ...base, channelId: ctx.channelId })
   : Promise.resolve(noChannel)),
 [AntiModPunishmentType.tempchannelban]: ({ executor, base, ctx }) =>
  (ctx.channelId
   ? executor.run(ModTypes.TempChannelBanAdd, {
      ...base,
      channelId: ctx.channelId,
      durationMs: ctx.durationMs,
     })
   : Promise.resolve(noChannel)),
};

export default async function (
 this: Pick<Plugin, 'client' | 'getAPI'>,
 ctx: DispatchContext,
 origin: PunishmentOrigin,
): Promise<void> {
 const moderation = this.client.plugins.find((plugin) => plugin instanceof ModerationPlugin) as
  | ModerationPlugin
  | undefined;
 if (!moderation) return;

 const api = await this.getAPI(ctx.guildId);
 const base: ModBaseOptions = {
  guildId: ctx.guildId,
  targetId: ctx.targetId,
  executorId: api.botId,
  reason: ctx.reason,
  caller: ModCallerContext.Automation,
  origin,
 };

 await dispatchTable[ctx.action]({
  executor: moderation.executor,
  base,
  ctx,
  deleteMessageSeconds: Math.min(maxDeleteMessageSeconds, ctx.deleteMessageSeconds),
 });
}
