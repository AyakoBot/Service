import type Client from '../Classes/Client.js';
import type { BaseLang } from '../Classes/abstracts/Plugin.js';

import { renderPlaceholderList, type MessagePlaceholder } from './messagePlaceholders.js';

export interface PlaceholderGroup {
 name: string;
 placeholders: MessagePlaceholder[];
}

export const placeholderGroups = async function (
 this: Client,
 applicationId: string | undefined,
 guildId: string,
): Promise<PlaceholderGroup[]> {
 const offering = this.plugins.filter((plugin) => plugin.placeholders?.length);
 const groups = offering.map((plugin) => ({
  name: plugin.name,
  placeholders: plugin.placeholders as MessagePlaceholder[],
 }));
 if (!applicationId || applicationId === this.getBaseAPI(guildId).botId) return groups;

 const owners = await Promise.all(
  offering.map(async (plugin) =>
   (await plugin.getAPI(guildId)).botId === applicationId ? plugin.name : null,
  ),
 );
 const owned = groups.filter((group) => owners.includes(group.name));

 return owned.length ? owned : groups;
};

const renderGroup = (group: PlaceholderGroup): string =>
 `**${group.name}**\n${renderPlaceholderList(group.placeholders)}`;

export const renderPlaceholderReference = (
 t: BaseLang['placeholders'],
 groups: PlaceholderGroup[],
): string => {
 const sections = groups.length ? groups.map(renderGroup).join('\n\n') : t.none();

 return `### ${t.title()}\n-# ${t.intro()}\n\n${sections}`;
};

export const placeholderReference = async function (
 this: Client,
 t: BaseLang['placeholders'],
 applicationId: string | undefined,
 guildId: string,
): Promise<string> {
 return renderPlaceholderReference(t, await placeholderGroups.call(this, applicationId, guildId));
};
