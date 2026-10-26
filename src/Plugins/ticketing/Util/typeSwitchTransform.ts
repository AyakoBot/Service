import type { TicketType } from '@ayako/database';

import type { FieldTransform } from '../../settings/SettingsSchema.js';

import { convertTemplate, isChannelKind } from './ticketName.js';

export const typeSwitchTransform: FieldTransform = async (value, ctx) => {
 const row = await ctx.client.db.client.ticketSetting.findUnique({ where: { id: ctx.rowId } });
 const toChannel = isChannelKind(value as TicketType);
 if (!row?.nameTemplate || toChannel === isChannelKind(row.type)) return { value };

 await ctx.client.db.client.ticketSetting.update({
  where: { id: ctx.rowId },
  data: { nameTemplate: convertTemplate(row.nameTemplate, toChannel) },
 });

 return { value };
};
