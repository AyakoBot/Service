import { SnippetErrors } from '../Classes/Enums.js';
import Snippet from '../Classes/Snippet.js';
import type TicketPlugin from '../Plugin.js';

export const snippetConflict = async function (
 this: TicketPlugin,
 guildId: string,
 data: { name: string; trigger?: string | null },
 excludeId?: string,
): Promise<SnippetErrors | null> {
 const taken = (row: { id: unknown } | null) => !!row && String(row.id) !== excludeId;

 if (taken(await Snippet.byName(this.client, guildId, data.name))) {
  return SnippetErrors.nameExists;
 }

 if (!data.trigger) return null;

 if (taken(await Snippet.byTrigger(this.client, guildId, data.trigger))) {
  return SnippetErrors.triggerExists;
 }

 const settings = await this.client.db.client.ticketSetting.findMany({
  where: { guild: guildId },
  select: { sendMessagePrefixes: true },
 });

 const trigger = data.trigger.toLowerCase();
 const shadowed = settings
  .flatMap((setting) => setting.sendMessagePrefixes)
  .some((prefix) => !!prefix && trigger.startsWith(prefix.toLowerCase()));

 return shadowed ? SnippetErrors.triggerPrefixConflict : null;
};
