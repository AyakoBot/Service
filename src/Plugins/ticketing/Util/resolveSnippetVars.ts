import type { Ticket, TicketSetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';

import { resolveStaffLabel } from './resolveStaffLabel.js';

export interface SnippetVarContext {
 guildId: string;
 staffId: string;
 ticket: (Ticket & { settings: TicketSetting }) | null;
 emotes: EmoteSet;
}

const resolveSnippetVars = async function (
 this: Client,
 text: string,
 ctx: SnippetVarContext,
): Promise<string> {
 const guild = await this.cache.guilds.get(ctx.guildId);

 const staff = await resolveStaffLabel.call(this, ctx.guildId, ctx.staffId, {
  name: `<@${ctx.staffId}>`,
  emote: ctx.emotes.member,
 });
 const claimer = ctx.ticket?.claimer
  ? await resolveStaffLabel.call(this, ctx.guildId, ctx.ticket.claimer, {
     name: `<@${ctx.ticket.claimer}>`,
     emote: ctx.emotes.member,
    })
  : { name: '', emote: undefined };

 const map: Record<string, string> = {
  user: ctx.ticket ? `<@${ctx.ticket.user}>` : '',
  staff: staff.name,
  claimer: claimer.name,
  server: guild?.name ?? '',
  kind: ctx.ticket ? String(ctx.ticket.settings.type) : '',
  ticket: ctx.ticket ? `<#${ctx.ticket.channel}>` : '',
 };

 return text.replace(/{{\s?([a-z]+)\s?}}/g, (whole, key: string) => {
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return whole;
 });
};

export default resolveSnippetVars;
