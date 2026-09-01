import type Client from '../../../Classes/Client.js';
import type { MessagePlaceholder } from '../../../Util/messagePlaceholders.js';

export interface PlaceholderGroup {
 name: string;
 placeholders: MessagePlaceholder[];
}

export interface PlaceholderScope {
 owned: PlaceholderGroup[];
 others: PlaceholderGroup[];
}

const groupsOf = (client: Client): PlaceholderGroup[] =>
 client.plugins
  .filter((plugin) => plugin.placeholders?.length)
  .map((plugin) => ({
   name: plugin.name,
   placeholders: plugin.placeholders as MessagePlaceholder[],
  }));

export const placeholderScope = async (
 client: Client,
 applicationId: string | undefined,
 guildId: string,
): Promise<PlaceholderScope> => {
 const groups = groupsOf(client);
 if (!applicationId) return { owned: groups, others: [] };

 const owners = await Promise.all(
  client.plugins
   .filter((plugin) => plugin.placeholders?.length)
   .map(async (plugin) => ({
    name: plugin.name,
    botId: (await plugin.getAPI(guildId)).botId,
   })),
 );

 const ownedNames = new Set(
  owners.filter((owner) => owner.botId === applicationId).map((owner) => owner.name),
 );

 if (!ownedNames.size) return { owned: groups, others: [] };

 return {
  owned: groups.filter((group) => ownedNames.has(group.name)),
  others: groups.filter((group) => !ownedNames.has(group.name)),
 };
};
