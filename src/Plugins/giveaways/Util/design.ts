import {
 MessageFlags,
 type APIEmbed,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import {
 countComponents,
 messageComponentLimit,
 type CountableComponent,
} from '../../../Util/componentBudget.js';
import type { SavedContent } from '../../../Util/savedRef.js';
import { designReserve } from '../constants.js';

export interface GiveawayDesign {
 content?: string;
 embeds?: APIEmbed[];
 components?: APIMessageTopLevelComponent[];
}

const maxEmbeds = 10;

const asRecord = (data: unknown): Record<string, unknown> | null =>
 data && typeof data === 'object' && !Array.isArray(data)
  ? (data as Record<string, unknown>)
  : null;

const filledEmbeds = (embeds: unknown): APIEmbed[] =>
 (Array.isArray(embeds) ? embeds : [])
  .filter((embed) => Object.keys(asRecord(embed) ?? {}).length)
  .slice(0, maxEmbeds) as APIEmbed[];

const v2Design = (components: unknown): GiveawayDesign | null =>
 Array.isArray(components) && components.length
  ? { components: components as APIMessageTopLevelComponent[] }
  : null;

export const normalizeDesign = (data: unknown): GiveawayDesign | null => {
 const message = asRecord(data);
 if (!message) return null;

 if (Number(message.flags) & MessageFlags.IsComponentsV2) return v2Design(message.components);

 const content =
  typeof message.content === 'string' && message.content.trim().length
   ? message.content
   : undefined;
 const embeds = filledEmbeds(message.embeds);
 if (!content && !embeds.length) return null;

 return { ...(content ? { content } : {}), ...(embeds.length ? { embeds } : {}) };
};

export const savedDesign = (saved: SavedContent | null): GiveawayDesign | null => {
 if (saved?.components) return v2Design(saved.components);

 return normalizeDesign(saved?.embed ? { embeds: [saved.embed] } : null);
};

export const designFits = (design: GiveawayDesign) =>
 !design.components ||
 countComponents(design.components as CountableComponent[]) + designReserve <=
  messageComponentLimit;
