import { API, RequestHandlerError } from '@ayako/api';
import { encrypt } from '@ayako/utility';

import type Plugin from '../Classes/abstracts/Plugin.js';
import type { FieldTransform } from '../Plugins/settings/SettingsSchema.js';

export interface BotTokenMessages {
 invalid: () => string;
 keyMissing: () => string;
}

export const createBotTokenTransform = (
 resolveMessages: (plugin: Plugin) => Promise<BotTokenMessages> | BotTokenMessages,
 onSaved?: (plugin: Plugin) => void,
): FieldTransform =>
 async (value, ctx) => {
  const plugin = ctx.plugin as Plugin;
  const messages = await resolveMessages(plugin);

  if (typeof value !== 'string' || value.length === 0) return { error: messages.invalid() };

  const api = new API(value, plugin.logger, ctx.client.cache, ctx.guildId);
  const self = await api.applications.getCurrent({
   origin: 'botTokenTransform',
   reason: 'Validating per-guild override bot token',
  });

  if (self instanceof RequestHandlerError) {
   plugin.nonFatalError(
    new Error('Per-guild override bot token failed validation', { cause: self }),
    'botTokenTransform',
   );
   return { error: messages.invalid() };
  }

  let cipher: string;
  try {
   cipher = encrypt(value);
  } catch (error) {
   plugin.nonFatalError(error as Error, 'botTokenTransform encrypt');
   return { error: messages.keyMissing() };
  }

  plugin.invalidateGuildAPI(ctx.guildId);
  onSaved?.(plugin);
  void ctx.client.emojis.ensureToken(value);
  return { value: cipher };
 };
