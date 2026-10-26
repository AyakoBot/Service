import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteractionDataBasicOption,
 type APIApplicationCommandOptionChoice,
} from 'discord-api-types/v10';

import { tagCommandName, ticketCommandName } from '../../Classes/Routes.js';
import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { resolveTicketHere } from '../../Util/resolveTicket.js';

type Responder = (choices: APIApplicationCommandOptionChoice[]) => Promise<unknown>;
type AutocompleteHandler = (
 this: TicketPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
 query: string,
 respond: Responder,
) => Promise<unknown>;

const focusedQuery = (options: APIApplicationCommandInteractionDataBasicOption[]): string => {
 const focused = options.find((o) => o.type === ApplicationCommandOptionType.String && o.focused);
 return focused?.type === ApplicationCommandOptionType.String ? focused.value.toLowerCase() : '';
};

const optionsOf = (cmd: APIApplicationCommandAutocompleteInteraction) =>
 (cmd.data.options ?? []).flatMap((o) =>
  o.type === ApplicationCommandOptionType.Subcommand ? (o.options ?? []) : [o],
 ) as APIApplicationCommandInteractionDataBasicOption[];

const ticketHere = function (
 this: TicketPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 return cmd.channel?.id ? resolveTicketHere.call(this.client, cmd.channel.id) : null;
};

const tierChoices: AutocompleteHandler = async function (cmd, query, respond) {
 const userId = cmd.member?.user.id;
 const ticket = userId ? await ticketHere.call(this, cmd) : null;
 const tiers = ticket && userId ? await ticket.reachableTiersFor(userId).catch(() => []) : [];

 return respond(
  tiers
   .filter((tier) => !query || tier.name.toLowerCase().includes(query))
   .slice(0, 25)
   .map((tier) => ({ name: tier.name.slice(0, 100), value: String(tier.id) })),
 );
};

const snippetChoices: AutocompleteHandler = async function (cmd, query, respond) {
 const ticket = await ticketHere.call(this, cmd);
 const kind = ticket ? String((await ticket.getTicket()).settings.type) : null;

 const snippets = await Snippet.all(this.client, cmd.guild_id ?? '');

 const choices = snippets
  .filter((s) => !s.kinds.length || (kind !== null && s.kinds.includes(kind)))
  .filter((s) => !query || s.name.toLowerCase().includes(query))
  .slice(0, 25)
  .map((s) => {
   const preview = (s.userText || s.staffText || '').replace(/[\n\r]+/g, ' ').trim();
   const label = preview ? `${s.name} - ${preview}` : s.name;
   return { name: label.slice(0, 100), value: s.name };
  });

 return respond(choices);
};

const handlers: Record<string, AutocompleteHandler> = {
 [tagCommandName]: snippetChoices,
 [ticketCommandName]: tierChoices,
};

export default async function (
 this: TicketPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 const handler = handlers[cmd.data.name];
 if (!cmd.guild_id || !handler) return;

 const api = await this.getAPI(cmd.guild_id);
 const respond: Responder = (choices) =>
  api.interactions.createAutocompleteResponse(
   cmd.id,
   cmd.token,
   { choices },
   { origin: this.name, reason: 'Ticket command autocomplete' },
  );

 await handler.call(this, cmd, focusedQuery(optionsOf(cmd)), respond);
}
