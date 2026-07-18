import {
 ApplicationCommandOptionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandOptionChoice,
} from 'discord-api-types/v10';

import { tagCommandName } from '../../Classes/Routes.js';
import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { resolveTicketByChannel, resolveTicketByStaffThread } from '../../Util/resolveTicket.js';

export default async function (
 this: TicketPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 if (!cmd.guild_id || cmd.data.name !== tagCommandName) return;

 const api = await this.getAPI(cmd.guild_id);
 const respond = (choices: APIApplicationCommandOptionChoice[]) =>
  api.interactions.createAutocompleteResponse(
   cmd.id,
   cmd.token,
   { choices },
   { origin: this.name, reason: 'Snippet name autocomplete' },
  );

 const focused = cmd.data.options?.find(
  (o) => o.type === ApplicationCommandOptionType.String && o.focused,
 );
 const query =
  focused?.type === ApplicationCommandOptionType.String ? focused.value.toLowerCase() : '';

 const channelId = cmd.channel?.id;
 const ticket = channelId
  ? (await resolveTicketByChannel.call(this.client, channelId)) ||
    (await resolveTicketByStaffThread.call(this.client, channelId))
  : null;
 const kind = ticket ? String((await ticket.getTicket()).settings.type) : null;

 const snippets = await Snippet.all(this.client, cmd.guild_id);

 const choices = snippets
  .filter((s) => !s.kinds.length || (kind !== null && s.kinds.includes(kind)))
  .filter((s) => !query || s.name.toLowerCase().includes(query))
  .slice(0, 25)
  .map((s) => {
   const preview = (s.userText || s.staffText || '').replace(/[\n\r]+/g, ' ').trim();
   const label = preview ? `${s.name} - ${preview}` : s.name;
   return { name: label.slice(0, 100), value: s.name };
  });

 await respond(choices);
}
