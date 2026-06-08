import type { Ticket, TicketSetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

import { resolveStaffLabel } from './resolveStaffLabel.js';

export interface SnippetVarContext {
 guildId: string;
 staffId: string;
 ticket: (Ticket & { settings: TicketSetting }) | null;
}

const resolveSnippetVars = async function (
 this: Client,
 text: string,
 ctx: SnippetVarContext,
): Promise<string> {
 const guild = await this.cache.guilds.get(ctx.guildId);

 const staff = await resolveStaffLabel.call(this, ctx.guildId, ctx.staffId, `<@${ctx.staffId}>`);
 const claimer = ctx.ticket?.claimer
  ? await resolveStaffLabel.call(this, ctx.guildId, ctx.ticket.claimer, `<@${ctx.ticket.claimer}>`)
  : '';

 const map: Record<string, string> = {
  user: ctx.ticket ? `<@${ctx.ticket.user}>` : '',
  staff,
  claimer,
  server: guild?.name ?? '',
  kind: ctx.ticket ? String(ctx.ticket.settings.type) : '',
  ticket: ctx.ticket ? `<#${ctx.ticket.channel}>` : '',
 };

 return text.replace(/{{\s?([a-z]+)\s?}}/g, (whole, key: string) =>
  (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : whole),
 );
};

export default resolveSnippetVars;
