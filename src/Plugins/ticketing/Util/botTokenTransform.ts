import { API, RequestHandlerError } from '@ayako/api';

import { encrypt } from '../../../Util/crypto.js';
import type { FieldTransform } from '../../settings/SettingsSchema.js';
import type TicketPlugin from '../Plugin.js';

export const botTokenTransform: FieldTransform = async (value, ctx) => {
 const plugin = ctx.plugin as TicketPlugin;
 const t = await plugin.t(ctx.guildId);

 if (typeof value !== 'string' || value.length === 0) {
  return { error: t.botToken.invalid() };
 }

 const api = new API(value, plugin.logger, ctx.client.cache, ctx.guildId);
 const self = await api.applications.getCurrent({
  origin: botTokenTransform.name,
  reason: 'Validating per-guild override bot token',
 });

 if (self instanceof RequestHandlerError) {
  plugin.nonFatalError(
   new Error('Per-guild override bot token failed validation', { cause: self }),
   botTokenTransform.name,
  );
  return { error: t.botToken.invalid() };
 }

 let cipher: string;
 try {
  cipher = encrypt(value);
 } catch (error) {
  plugin.nonFatalError(error as Error, `${botTokenTransform.name} encrypt`);
  return { error: t.botToken.keyMissing() };
 }

 plugin.invalidateGuildAPI(ctx.guildId);
 return { value: cipher };
};
